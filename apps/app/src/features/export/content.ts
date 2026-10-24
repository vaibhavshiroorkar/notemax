import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import type * as Y from "yjs";
import { loadAsset, openLocalDoc, type Asset, type Tree } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { assetsIn, type DocNode, type Resolve } from "./serialize";

/**
 * Reads a page's own document. An open page is read from memory, so a
 * download includes the last few keystrokes. Others are read from storage and
 * closed again, so downloading everything does not fill the cache. The page
 * is in the shown workspace unless `workspace` names another.
 */
export async function withPageDoc<T>(id: string, read: (doc: Y.Doc) => T, workspace = workspaceNow()): Promise<T> {
  const open = peekDoc(id, workspace);
  if (open) return read(open.doc);
  const local = await openLocalDoc(await storeFor(workspace), id);
  try {
    return read(local.doc);
  } finally {
    await local.close();
  }
}

/** A body with anything in it beyond empty paragraphs. */
export const isWritten = (body: DocNode) => (body.content ?? []).some((block) => block.type !== "paragraph" || (block.content?.length ?? 0) > 0);

export const loadBody = (id: string, workspace = workspaceNow()): Promise<DocNode> =>
  withPageDoc(id, (doc) => yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")) as DocNode, workspace);

/**
 * Loads every picture these bodies use, by asset id. Missing ones are left out.
 * `made` holds pictures drawn for the download, like a board in a book.
 */
export async function loadPictures(bodies: DocNode[], made: ReadonlyMap<string, Asset> = new Map(), workspace = workspaceNow()): Promise<Map<string, Asset>> {
  const ids = new Set<string>();
  for (const body of bodies) assetsIn(body, ids);
  const store = await storeFor(workspace);
  const out = new Map<string, Asset>();
  for (const id of ids) {
    const asset = made.get(id) ?? (await loadAsset(store, id));
    if (asset) out.set(id, asset);
  }
  return out;
}

export function dataUrl(asset: Asset): string {
  let binary = "";
  // In slices: one call with a large picture would overflow the argument list.
  for (let i = 0; i < asset.bytes.length; i += 0x8000) binary += String.fromCharCode(...asset.bytes.subarray(i, i + 0x8000));
  return `data:${asset.type};base64,${btoa(binary)}`;
}

/** The file extension for a picture type. */
export const extOf = (type: string) => ({ "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" })[type] ?? "bin";

/** Link titles from the tree, and pictures the way a format wants them. */
export function resolver(tree: Tree, image: (asset: string) => string | null = () => null): Resolve {
  return { title: (id) => (tree.byId.has(id) ? tree.byId.get(id)!.title || "Untitled" : null), image };
}

/** A file name from a title, safe on every system. */
export function fileName(title: string, ext: string): string {
  const base = (title || "Untitled").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled";
  return `${base}.${ext}`;
}
