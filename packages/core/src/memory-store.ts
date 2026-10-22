import type { DocStore } from "./store";

/**
 * A store that keeps everything in memory and nothing on disk, for a device
 * that should not keep pages once the app closes. Sync fills it at start and
 * sends what is written to it.
 */
export function createMemoryStore(): DocStore {
  const docs = new Map<string, { seq: number; update: Uint8Array }[]>();
  let seq = 0;
  return {
    async load(docId) {
      const rows = docs.get(docId) ?? [];
      return { updates: rows.map((row) => row.update), lastSeq: rows.at(-1)?.seq ?? 0 };
    },
    async append(docId, update) {
      const rows = docs.get(docId) ?? [];
      rows.push({ seq: ++seq, update });
      docs.set(docId, rows);
    },
    async compact(docId, merged, upToSeq) {
      const later = (docs.get(docId) ?? []).filter((row) => row.seq > upToSeq);
      docs.set(docId, [{ seq: upToSeq, update: merged }, ...later]);
    },
    async remove(docId) {
      docs.delete(docId);
    },
    async list() {
      return [...docs.keys()];
    },
  };
}
