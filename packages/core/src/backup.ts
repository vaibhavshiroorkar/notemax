import * as Y from "yjs";
import type { DocStore } from "./store";

// A backup is every doc in a store, in one file: all workspaces, the list of
// them, settings, versions and pictures. Each doc is its whole Yjs state, so
// restoring is a merge: edits made after the backup stay, and whatever the
// backup has that the store lost comes back.
//
// Layout: the magic line, a 4-byte length and a JSON header listing each doc
// and its length, then the docs' bytes in that order.

const MAGIC = new TextEncoder().encode("NOTEMAX-BACKUP\n");
const FORMAT = 1;

export interface BackupInfo {
  /** The app version that made it. */
  app: string;
  made: number;
}

interface Header extends BackupInfo {
  format: number;
  docs: [string, number][];
}

const notBackup = () => new Error("Not a Notemax backup");

export async function packBackup(store: DocStore, info: BackupInfo): Promise<Uint8Array> {
  const docs: [string, Uint8Array][] = [];
  for (const docId of (await store.list()).sort()) {
    const { updates } = await store.load(docId);
    if (updates.length) docs.push([docId, Y.mergeUpdates(updates)]);
  }
  const header: Header = { format: FORMAT, app: info.app, made: info.made, docs: docs.map(([id, data]) => [id, data.length]) };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(MAGIC.length + 4 + json.length + docs.reduce((sum, [, data]) => sum + data.length, 0));
  out.set(MAGIC, 0);
  new DataView(out.buffer).setUint32(MAGIC.length, json.length);
  out.set(json, MAGIC.length + 4);
  let at = MAGIC.length + 4 + json.length;
  for (const [, data] of docs) {
    out.set(data, at);
    at += data.length;
  }
  return out;
}

export function readBackup(bytes: Uint8Array): { info: BackupInfo; docs: Map<string, Uint8Array> } {
  if (bytes.length < MAGIC.length + 4 || MAGIC.some((b, i) => bytes[i] !== b)) throw notBackup();
  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(MAGIC.length);
  const start = MAGIC.length + 4;
  let header: Header;
  try {
    header = JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + length))) as Header;
  } catch {
    throw notBackup();
  }
  if (header.format !== FORMAT || !Array.isArray(header.docs)) throw notBackup();
  const docs = new Map<string, Uint8Array>();
  let at = start + length;
  for (const [id, size] of header.docs) {
    if (typeof id !== "string" || !Number.isInteger(size) || size < 0 || at + size > bytes.length) throw notBackup();
    docs.set(id, bytes.slice(at, at + size));
    at += size;
  }
  if (at !== bytes.length) throw notBackup();
  return { info: { app: String(header.app), made: Number(header.made) }, docs };
}

/** Merges a backup into the store. Returns how many docs it held. Nothing in the store is removed. */
export async function restoreBackup(store: DocStore, bytes: Uint8Array): Promise<number> {
  const { docs } = readBackup(bytes);
  for (const [docId, update] of docs) {
    const { updates } = await store.load(docId);
    // Only what the store lacks, so restoring twice does not grow it.
    const fresh = updates.length ? Y.diffUpdate(update, Y.encodeStateVectorFromUpdate(Y.mergeUpdates(updates))) : update;
    await store.append(docId, fresh);
  }
  return docs.size;
}
