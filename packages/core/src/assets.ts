import type { DocStore } from "./store";
import { openLocalDoc } from "./local-doc";

/**
 * Pictures and other files placed in pages. Each one is its own small Yjs doc
 * in the same store as notes, so it is saved, synced and backed up the same
 * way. The id is the file's SHA-256, so the same picture pasted twice is kept
 * once.
 */
export interface Asset {
  bytes: Uint8Array;
  /** Like "image/png". */
  type: string;
  name: string;
}

const PREFIX = "asset:";

export const isAssetId = (id: string) => /^[0-9a-f]{64}$/.test(id);
export const assetDocId = (id: string) => `${PREFIX}${id}`;

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Keeps a file and returns its id. Keeping the same bytes again changes nothing. */
export async function saveAsset(store: DocStore, asset: Asset): Promise<string> {
  const id = await sha256(asset.bytes);
  const local = await openLocalDoc(store, assetDocId(id));
  try {
    const file = local.doc.getMap<unknown>("file");
    if (!file.has("bytes")) {
      local.doc.transact(() => {
        file.set("type", asset.type);
        file.set("name", asset.name);
        file.set("bytes", asset.bytes);
      });
    }
    await local.flush();
  } finally {
    await local.close();
  }
  return id;
}

/** The file with this id, or null when this device does not have it. */
export async function loadAsset(store: DocStore, id: string): Promise<Asset | null> {
  if (!isAssetId(id)) return null;
  const local = await openLocalDoc(store, assetDocId(id));
  try {
    const file = local.doc.getMap<unknown>("file");
    const bytes = file.get("bytes");
    if (!(bytes instanceof Uint8Array)) return null;
    return { bytes, type: String(file.get("type") ?? "application/octet-stream"), name: String(file.get("name") ?? "file") };
  } finally {
    await local.close();
  }
}
