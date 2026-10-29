import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocStore } from "./store";

interface NotemaxDB extends DBSchema {
  updates: {
    key: number;
    value: { id?: number; docId: string; update: Uint8Array };
    indexes: { byDoc: [string, number] };
  };
}

// One auto-increment id across all docs gives every append a unique, ordered
// seq, even when two tabs append to the same doc at the same moment.
export async function openIdbStore(name = "notemax"): Promise<DocStore> {
  const store = new IdbStore(() =>
    openDB<NotemaxDB>(name, 1, {
      upgrade(db) {
        const updates = db.createObjectStore("updates", { keyPath: "id", autoIncrement: true });
        updates.createIndex("byDoc", ["docId", "id"]);
      },
      // The browser closed the database under us, as it can when storage is
      // cleared or the disk fails. Open it again rather than fail every write from now on.
      terminated: () => store.reopen(),
    }),
  );
  await store.ready();
  return store;
}

function docRange(docId: string, upTo = Infinity) {
  return IDBKeyRange.bound([docId, -Infinity], [docId, upTo]);
}

// Writes ask for strict durability: the promise resolves once the update is
// on disk, not just handed to the OS, as DocStore promises.
const STRICT = { durability: "strict" } as const;

class IdbStore implements DocStore {
  private opening: Promise<IDBPDatabase<NotemaxDB>>;

  constructor(private open: () => Promise<IDBPDatabase<NotemaxDB>>) {
    this.opening = open();
  }

  ready() {
    return this.opening.then(() => undefined);
  }

  reopen() {
    this.opening = this.open();
  }

  async load(docId: string) {
    const rows = await (await this.opening).getAllFromIndex("updates", "byDoc", docRange(docId));
    return {
      updates: rows.map((row) => row.update),
      lastSeq: rows.length ? rows[rows.length - 1].id! : 0,
    };
  }

  async append(docId: string, update: Uint8Array) {
    const tx = (await this.opening).transaction("updates", "readwrite", STRICT);
    await tx.store.add({ docId, update });
    await tx.done;
  }

  async compact(docId: string, merged: Uint8Array, upToSeq: number) {
    // Delete and re-insert in one transaction: either both happen or neither does.
    const tx = (await this.opening).transaction("updates", "readwrite", STRICT);
    let cursor = await tx.store.index("byDoc").openCursor(docRange(docId, upToSeq));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.store.put({ id: upToSeq, docId, update: merged });
    await tx.done;
  }

  async list() {
    const ids: string[] = [];
    // Jumps from one doc to the next instead of reading every update.
    let cursor = await (await this.opening).transaction("updates").store.index("byDoc").openKeyCursor();
    while (cursor) {
      const docId = cursor.key[0];
      ids.push(docId);
      cursor = await cursor.continue([docId, Infinity]);
    }
    return ids;
  }

  async remove(docId: string) {
    const tx = (await this.opening).transaction("updates", "readwrite", STRICT);
    let cursor = await tx.store.index("byDoc").openCursor(docRange(docId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
