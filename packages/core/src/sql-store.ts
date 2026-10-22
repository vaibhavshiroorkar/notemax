import type { DocStore } from "./store";

/**
 * The part of @tauri-apps/plugin-sql's Database that the store uses.
 * Kept as an interface so tests can run the same store on Node's built-in SQLite.
 * Parameters are written $1, $2, ...
 */
export interface SqlDatabase {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

/** Expects the `updates` table from schema.sql to exist. */
export function createSqlStore(db: SqlDatabase): DocStore {
  return {
    async load(docId) {
      const rows = await db.select<{ id: number; data: string }>(
        "SELECT id, data FROM updates WHERE doc_id = $1 ORDER BY id",
        [docId],
      );
      return { updates: rows.map((row) => fromBase64(row.data)), lastSeq: rows.at(-1)?.id ?? 0 };
    },

    async append(docId, update) {
      await db.execute("INSERT INTO updates (doc_id, data) VALUES ($1, $2)", [docId, toBase64(update)]);
    },

    async compact(docId, merged, upToSeq) {
      // The SQL plugin may run each call on a different pooled connection, so a
      // transaction cannot span these two statements. Insert first, then delete:
      // a crash in between leaves a duplicate, which Yjs ignores, never a gap.
      await db.execute("INSERT INTO updates (doc_id, data) VALUES ($1, $2)", [docId, toBase64(merged)]);
      await db.execute("DELETE FROM updates WHERE doc_id = $1 AND id <= $2", [docId, upToSeq]);
    },

    async remove(docId) {
      await db.execute("DELETE FROM updates WHERE doc_id = $1", [docId]);
    },

    async list() {
      const rows = await db.select<{ doc_id: string }>("SELECT DISTINCT doc_id FROM updates");
      return rows.map((row) => row.doc_id);
    },
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // Chunked so String.fromCharCode never gets more arguments than the engine allows.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
