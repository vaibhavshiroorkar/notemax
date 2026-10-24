import { loadAsset, saveAsset } from "@notemax/core";
import { storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";

// Pictures are kept in the workspace of the note that shows them. Callers in
// a note name it (workspaceOf the editor), since a tab can hold a note from
// another workspace than the sidebar shows.

/** The biggest picture kept. Larger ones are refused with a message, not shrunk without asking. */
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const isImage = (file: File) => file.type.startsWith("image/");

/** Keeps a picture on this device and returns its id. */
export async function saveImage(file: Blob, name = "picture", workspace = workspaceNow()): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`Pictures can be up to ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return saveAsset(await storeFor(workspace), { bytes, type: file.type || "image/png", name });
}

// Each picture is read once per session and shown from memory after that.
const urls = new Map<string, Promise<string | null>>();

/** A URL the page can show, or null when this device does not have the picture. */
export function imageUrl(asset: string, workspace = workspaceNow()): Promise<string | null> {
  const key = `${workspace}
${asset}`;
  let url = urls.get(key);
  if (!url) {
    url = storeFor(workspace)
      .then((store) => loadAsset(store, asset))
      .then((file) => (file ? URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: file.type })) : null));
    urls.set(key, url);
    // A failed read is tried again next time.
    url.catch(() => urls.delete(key));
  }
  return url;
}

export async function imageBlob(asset: string, workspace = workspaceNow()): Promise<{ blob: Blob; name: string } | null> {
  const file = await loadAsset(await storeFor(workspace), asset);
  return file ? { blob: new Blob([file.bytes as BlobPart], { type: file.type }), name: file.name } : null;
}

/** A file picker for pictures. Resolves to nothing when it is closed. */
export function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => resolve([...(input.files ?? [])]);
    input.oncancel = () => resolve([]);
    input.click();
  });
}
