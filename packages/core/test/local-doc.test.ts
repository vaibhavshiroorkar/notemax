import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createSqlStore, openIdbStore, openLocalDoc, type DocStore } from "../src";
import { memorySqlDatabase } from "./node-sqlite";

let dbCount = 0;
// Every test runs against both stores, so they keep the same promises.
const stores: [string, () => Promise<DocStore>][] = [
  ["IndexedDB", () => openIdbStore(`test-${++dbCount}`)],
  ["SQLite", async () => createSqlStore(memorySqlDatabase())],
];
const text = (doc: Y.Doc) => doc.getText("t").toString();

describe.each(stores)("%s store", (_name, freshStore) => {
  describe("openLocalDoc", () => {
    it("saves edits and loads them back", async () => {
      const store = await freshStore();
      const a = await openLocalDoc(store, "note");
      a.doc.getText("t").insert(0, "hello");
      await a.close();

      const b = await openLocalDoc(store, "note");
      expect(text(b.doc)).toBe("hello");
      expect(b.status().state).toBe("saved");
    });

    it("keeps docs separate", async () => {
      const store = await freshStore();
      const a = await openLocalDoc(store, "a");
      const b = await openLocalDoc(store, "b");
      a.doc.getText("t").insert(0, "A");
      b.doc.getText("t").insert(0, "B");
      await Promise.all([a.close(), b.close()]);

      expect(text((await openLocalDoc(store, "a")).doc)).toBe("A");
      expect(text((await openLocalDoc(store, "b")).doc)).toBe("B");
    });

    it("keeps edits from two tabs open on the same note", async () => {
      const store = await freshStore();
      const tab1 = await openLocalDoc(store, "note");
      const tab2 = await openLocalDoc(store, "note");
      tab1.doc.getText("t").insert(0, "one ");
      tab2.doc.getText("t").insert(0, "two ");
      await Promise.all([tab1.close(), tab2.close()]);

      const reopened = text((await openLocalDoc(store, "note")).doc);
      expect(reopened).toContain("one ");
      expect(reopened).toContain("two ");
    });

    it("compacts many updates into one without losing text", async () => {
      const store = await freshStore();
      const a = await openLocalDoc(store, "note", { batchMs: 0 });
      for (let i = 0; i < 150; i++) {
        a.doc.getText("t").insert(i, "x");
        await a.flush();
      }
      await a.close();
      expect((await store.load("note")).updates.length).toBe(150);

      const b = await openLocalDoc(store, "note", { compactAbove: 100 });
      await b.close();
      // Compaction runs in the background, so wait for the store to settle.
      await new Promise((r) => setTimeout(r, 50));

      const after = await store.load("note");
      expect(after.updates.length).toBe(1);
      expect(text((await openLocalDoc(store, "note")).doc)).toBe("x".repeat(150));
    });

    it("keeps an update that arrives while compaction is running", async () => {
      const store = await freshStore();
      const a = await openLocalDoc(store, "note");
      a.doc.getText("t").insert(0, "old");
      await a.close();

      // Another tab appends after this snapshot was taken but before compact() runs.
      const { updates, lastSeq } = await store.load("note");
      const other = new Y.Doc();
      Y.applyUpdate(other, Y.mergeUpdates(updates));
      const before = Y.encodeStateVector(other);
      other.getText("t").insert(3, " new");
      await store.append("note", Y.encodeStateAsUpdate(other, before));

      await store.compact("note", Y.mergeUpdates(updates), lastSeq);
      expect(text((await openLocalDoc(store, "note")).doc)).toBe("old new");
    });

    it("reports an error and keeps the edits when a write fails, then retries", async () => {
      const real = await freshStore();
      let failNext = true;
      const flaky: DocStore = {
        load: (id) => real.load(id),
        compact: (id, m, s) => real.compact(id, m, s),
        append: async (id, u) => {
          if (failNext) {
            failNext = false;
            throw new Error("disk full");
          }
          return real.append(id, u);
        },
      };

      const a = await openLocalDoc(flaky, "note", { batchMs: 0, retryMs: 10 });
      const seen: string[] = [];
      a.onStatus((s) => seen.push(s.state));
      a.doc.getText("t").insert(0, "precious");

      await expect(a.flush()).rejects.toThrow("disk full");
      expect(a.status()).toEqual({ state: "error", message: "disk full" });

      await new Promise((r) => setTimeout(r, 50));
      expect(a.status().state).toBe("saved");
      expect(seen).toEqual(["saving", "error", "saved"]);
      expect(text((await openLocalDoc(real, "note")).doc)).toBe("precious");
    });
  });

  describe("speed budget", () => {
    it("opens one note quickly when 5,000 notes are stored", { timeout: 120_000 }, async () => {
      const store = await freshStore();
      const paragraph = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20);
      for (let i = 0; i < 5000; i++) {
        const doc = new Y.Doc();
        doc.getText("t").insert(0, `Note ${i}. ${paragraph}`);
        await store.append(`note-${i}`, Y.encodeStateAsUpdate(doc));
      }

      const start = performance.now();
      const note = await openLocalDoc(store, "note-4321");
      const ms = performance.now() - start;
      console.log(`open 1 of 5,000 notes: ${ms.toFixed(1)} ms`);

      expect(text(note.doc)).toContain("Note 4321.");
      expect(ms).toBeLessThan(200);
    });

    it("opens a long note made of 2,000 separate saves quickly", { timeout: 120_000 }, async () => {
      const store = await freshStore();
      const writer = await openLocalDoc(store, "long", { batchMs: 0 });
      for (let i = 0; i < 2000; i++) {
        writer.doc.getText("t").insert(writer.doc.getText("t").length, `Sentence number ${i}. `);
        await writer.flush();
      }
      await writer.close();

      const start = performance.now();
      const note = await openLocalDoc(store, "long", { compactAbove: Infinity });
      const ms = performance.now() - start;
      console.log(`open note with 2,000 stored updates: ${ms.toFixed(1)} ms`);

      expect(text(note.doc)).toContain("Sentence number 1999.");
      expect(ms).toBeLessThan(500);
    });
  });
});
