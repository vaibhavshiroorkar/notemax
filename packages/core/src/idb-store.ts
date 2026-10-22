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
  const db = await openDB<NotemaxDB>(name, 1, {
    upgrade(db) {
      const updates = db.createObjectStore("updates", { keyPath: "id", autoIncrement: true });
      updates.createIndex("byDoc", ["docId", "id"]);
    },
  });
  return new IdbStore(db);
}

function docRange(docId: string, upTo = Infinity) {
  return IDBKeyRange.bound([docId, -Infinity], [docId, upTo]);
}

class IdbStore implements DocStore {
  constructor(private db: IDBPDatabase<NotemaxDB>) {}

  async load(docId: string) {
    const rows = await this.db.getAllFromIndex("updates", "byDoc", docRange(docId));
    return {
      updates: rows.map((row) => row.update),
      lastSeq: rows.length ? rows[rows.length - 1].id! : 0,
    };
  }

  async append(docId: string, update: Uint8Array) {
    await this.db.add("updates", { docId, update });
  }

  async compact(docId: string, merged: Uint8Array, upToSeq: number) {
    // Delete and re-insert in one transaction: either both happen or neither does.
    const tx = this.db.transaction("updates", "readwrite");
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
    let cursor = await this.db.transaction("updates").store.index("byDoc").openKeyCursor();
    while (cursor) {
      const docId = cursor.key[0];
      ids.push(docId);
      cursor = await cursor.continue([docId, Infinity]);
    }
    return ids;
  }

  async remove(docId: string) {
    const tx = this.db.transaction("updates", "readwrite");
    let cursor = await tx.store.index("byDoc").openCursor(docRange(docId));
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
