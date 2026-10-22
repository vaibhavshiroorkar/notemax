import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createMemoryStore, createSqlStore, createSyncEngine, newKey, openIdbStore, openLocalDoc, unlockKey, type DocStore, type RemoteEntry, type SyncRemote, type SyncState, type SyncStatus } from "../src";
import { memorySqlDatabase } from "./node-sqlite";

// Few rounds, so the tests run fast. The app uses the real number.
const ROUNDS = 1000;

/** A shared folder in memory, standing in for Google Drive. */
class FakeDrive {
  files = new Map<string, { data: Uint8Array; seq: number; docId: string; device: string }>();
  seq = 0;
  failReads = 0;
  /** Each read and write waits this long, like a slow network. */
  delayMs = 0;
  /** Called inside each write, before it lands. */
  duringWrite: ((docId: string) => Promise<void>) | null = null;
  inFlight = 0;
  maxInFlight = 0;

  private async slow<T>(work: () => Promise<T> | T): Promise<T> {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs));
      return await work();
    } finally {
      this.inFlight--;
    }
  }

  as(device: string): SyncRemote {
    return {
      changes: async (cursor) => {
        const since = cursor === null ? 0 : Number(cursor);
        const entries: RemoteEntry[] = [...this.files.entries()].filter(([, f]) => f.seq > since).map(([ref, f]) => ({ ref, docId: f.docId, device: f.device }));
        return { entries, cursor: String(this.seq) };
      },
      read: (ref) =>
        this.slow(() => {
          if (this.failReads > 0) {
            this.failReads--;
            throw new Error("network down");
          }
          return this.files.get(ref)!.data;
        }),
      write: (docId, data) =>
        this.slow(async () => {
          await this.duringWrite?.(docId);
          this.files.set(`${docId}@${device}`, { data, seq: ++this.seq, docId, device });
        }),
      remove: async (docId) => {
        this.files.delete(`${docId}@${device}`);
      },
    };
  }
}

async function device(name: string, drive: FakeDrive, key: CryptoKey, store: DocStore) {
  let state: SyncState = { cursor: null, dirty: [] };
  const received: string[] = [];
  const updates: Uint8Array[] = [];
  const statuses: SyncStatus[] = [];
  const conflicts: { docId: string; mine: Uint8Array; theirs: Uint8Array }[] = [];
  const engine = createSyncEngine({
    store,
    remote: drive.as(name),
    key,
    device: name,
    loadState: () => state,
    saveState: (next) => (state = next),
    onRemoteUpdate: (docId, update) => {
      received.push(docId);
      updates.push(update);
    },
    onStatus: (status) => statuses.push(status),
    onConflict: (docId, mine, theirs) => conflicts.push({ docId, mine, theirs }),
  });
  /** Types into a note the way the app does: through a local doc that saves to the store. */
  const type = async (docId: string, text: string) => {
    const local = await openLocalDoc(store, docId, { batchMs: 0 });
    local.doc.getText("body").insert(local.doc.getText("body").length, text);
    await local.close();
    engine.markDirty(docId);
  };
  const read = async (docId: string) => {
    const local = await openLocalDoc(store, docId);
    const text = local.doc.getText("body").toString();
    await local.close();
    return text;
  };
  return { engine, type, read, received, updates, statuses, conflicts, store, state: () => state };
}

describe.each([
  ["IndexedDB", (name: string) => openIdbStore(`sync-${name}-${Math.random()}`)],
  ["SQLite", async () => createSqlStore(memorySqlDatabase())],
  ["memory", async () => createMemoryStore()],
])("sync with %s", (_name, freshStore) => {
  const setup = async () => {
    const drive = new FakeDrive();
    const { key } = await newKey("correct horse", ROUNDS);
    const a = await device("laptop", drive, key, await freshStore("a"));
    const b = await device("phone", drive, key, await freshStore("b"));
    return { drive, key, a, b };
  };

  it("brings a note written on one device to another", async () => {
    const { a, b } = await setup();
    await a.type("note-1", "Hello from the laptop.");
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.read("note-1")).toBe("Hello from the laptop.");
    expect(b.received).toEqual(["note-1"]);
  });

  it("keeps both devices' text when both edited the same note offline", async () => {
    const { a, b } = await setup();
    await a.type("note-1", "Start. ");
    await a.engine.sync();
    await b.engine.sync();
    // Both offline now, each adding a line.
    await a.type("note-1", "Laptop line. ");
    await b.type("note-1", "Phone line. ");
    await a.engine.sync();
    await b.engine.sync();
    await a.engine.sync();
    const onA = await a.read("note-1");
    const onB = await b.read("note-1");
    expect(onA).toBe(onB);
    expect(onA).toContain("Laptop line.");
    expect(onA).toContain("Phone line.");
    expect(onA.startsWith("Start. ")).toBe(true);
  });

  it("asks about a note both devices edited before syncing, with each side as it was", async () => {
    const { a, b } = await setup();
    await a.type("note-1", "Start. ");
    await a.type("note-2", "Only the laptop. ");
    await a.engine.sync();
    await b.engine.sync();
    await a.type("note-1", "Laptop line. ");
    await a.type("note-2", "Still only the laptop. ");
    await b.type("note-1", "Phone line. ");
    await a.engine.sync();
    // The phone still has its line unsent when the laptop's arrives.
    await b.engine.sync();
    await a.engine.sync();

    expect(a.conflicts).toEqual([]);
    expect(b.conflicts.map((c) => c.docId)).toEqual(["note-1"]);
    const text = (update: Uint8Array) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, update);
      return doc.getText("body").toString();
    };
    expect(text(b.conflicts[0].mine)).toBe("Start. Phone line. ");
    expect(text(b.conflicts[0].theirs)).toBe("Start. Laptop line. ");
    // Nothing is lost while the question waits.
    expect(await b.read("note-1")).toContain("Laptop line.");
    expect(await b.read("note-1")).toContain("Phone line.");
  });

  it("never writes another device's file", async () => {
    const { drive, a, b } = await setup();
    await a.type("note-1", "One.");
    await a.engine.sync();
    await b.engine.sync();
    await b.type("note-1", " Two.");
    await b.engine.sync();
    expect([...drive.files.keys()].sort()).toEqual(["note-1@laptop", "note-1@phone"]);
  });

  it("sends nothing back after only receiving", async () => {
    const { drive, a, b } = await setup();
    await a.type("note-1", "One.");
    await a.engine.sync();
    const before = drive.seq;
    await b.engine.sync();
    await b.engine.sync();
    expect(drive.seq).toBe(before);
    expect(b.state().dirty).toEqual([]);
  });

  it("stores only sealed bytes in the shared folder", async () => {
    const { drive, a } = await setup();
    await a.type("note-1", "A secret plan for the heron.");
    await a.engine.sync();
    const stored = new TextDecoder("latin1").decode(drive.files.get("note-1@laptop")!.data);
    expect(stored).not.toContain("heron");
  });

  it("cannot read the files with the wrong passphrase, and says so", async () => {
    const { drive, key, a } = await setup();
    await a.type("note-1", "Hello.");
    await a.engine.sync();
    const { key: wrong } = await newKey("wrong horse", ROUNDS);
    expect(wrong).not.toBe(key);
    const intruder = await device("intruder", drive, wrong, await freshStore("c"));
    await expect(intruder.engine.sync()).rejects.toThrow();
    expect(intruder.engine.status().state).toBe("error");
    expect(intruder.state().cursor).toBeNull();
  });

  it("reads everything again after a failure part way, and loses nothing", async () => {
    const { drive, a, b } = await setup();
    await a.type("note-1", "First.");
    await a.type("note-2", "Second.");
    await a.engine.sync();
    drive.failReads = 1;
    await expect(b.engine.sync()).rejects.toThrow("network down");
    await b.engine.sync();
    expect(await b.read("note-1")).toBe("First.");
    expect(await b.read("note-2")).toBe("Second.");
  });

  it("sends every local doc once sync is turned on", async () => {
    const { drive, a } = await setup();
    const store = await freshStore("d");
    const local = await openLocalDoc(store, "old-note", { batchMs: 0 });
    local.doc.getText("body").insert(0, "Written before sync.");
    await local.close();
    const late = await device("desktop", drive, (await newKey("x", ROUNDS)).key, store);
    await late.engine.markAllDirty();
    await late.engine.sync();
    expect(drive.files.has("old-note@desktop")).toBe(true);
    // The other device cannot read it: it was sealed with another passphrase.
    await expect(a.engine.sync()).rejects.toThrow();
  });

  it("sends and reads several files at once, but not too many", async () => {
    const { drive, a, b } = await setup();
    drive.delayMs = 5;
    for (let i = 0; i < 20; i++) await a.type(`note-${i}`, `Note ${i}`);
    await a.engine.sync();
    expect(drive.maxInFlight).toBeGreaterThan(1);
    expect(drive.maxInFlight).toBeLessThanOrEqual(10);
    drive.maxInFlight = 0;
    await b.engine.sync();
    expect(drive.maxInFlight).toBeGreaterThan(1);
    expect(drive.maxInFlight).toBeLessThanOrEqual(10);
    for (let i = 0; i < 20; i++) expect(await b.read(`note-${i}`)).toBe(`Note ${i}`);
    expect(a.state().dirty).toEqual([]);
  });

  it("counts the files as they go, so a long first sync shows it is moving", async () => {
    const { a, b } = await setup();
    for (let i = 0; i < 12; i++) await a.type(`note-${i}`, `Note ${i}`);
    await a.engine.sync();
    await b.engine.sync();
    for (const side of [a, b]) {
      const counts = side.statuses.flatMap((s) => (s.state === "syncing" && s.total ? [`${s.done}/${s.total}`] : []));
      expect(counts[0]).toBe("0/12");
      expect(counts.at(-1)).toBe("12/12");
      expect(counts).toHaveLength(13);
    }
    expect(a.statuses.at(-1)?.state).toBe("idle");
  });

  it("keeps an edit made while its note was being sent, and sends it next time", async () => {
    const { drive, a, b } = await setup();
    await a.type("note-1", "First.");
    drive.duringWrite = async () => {
      drive.duringWrite = null;
      await a.type("note-1", " Second.");
    };
    await a.engine.sync();
    expect(a.state().dirty).toEqual(["note-1"]);
    await a.engine.sync();
    await b.engine.sync();
    expect(await b.read("note-1")).toBe("First. Second.");
  });

  it("merges one note's files from two devices into a third", async () => {
    const { drive, key, a, b } = await setup();
    const c = await device("tablet", drive, key, await freshStore("c"));
    drive.delayMs = 3;
    await a.type("note-1", "From the laptop.");
    await b.type("note-1", "From the phone.");
    await a.engine.sync();
    await b.engine.sync();
    await c.engine.sync();
    const text = await c.read("note-1");
    expect(text).toContain("From the laptop.");
    expect(text).toContain("From the phone.");
  });

  it("removes this device's file when the doc is gone", async () => {
    const { drive, a } = await setup();
    await a.type("note-1", "Bye.");
    await a.engine.sync();
    expect(drive.files.has("note-1@laptop")).toBe(true);
    await a.store.remove("note-1");
    a.engine.markDirty("note-1");
    await a.engine.sync();
    expect(drive.files.has("note-1@laptop")).toBe(false);
  });

  it("hands each incoming update to the app, so an open note can merge it", async () => {
    const { a, b } = await setup();
    await a.type("note-1", "Live.");
    await a.engine.sync();
    await b.engine.sync();
    const open = new Y.Doc();
    b.updates.forEach((update) => Y.applyUpdate(open, update));
    expect(open.getText("body").toString()).toBe("Live.");
  });
});

describe("passphrase", () => {
  it("unlocks with the right passphrase and refuses a wrong one", async () => {
    const { check } = await newKey("correct horse", ROUNDS);
    expect(await unlockKey("correct horse", check)).not.toBeNull();
    expect(await unlockKey("Correct horse", check)).toBeNull();
  });
});
