import * as Y from "yjs";
import { prosemirrorJSONToYXmlFragment, yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { ROOT, WORKSPACE_DOC_ID, addTag, createNode, readTree, renameNode, saveAsset, splitScoped, trashNode, type Tree, type TreeItem } from "@notemax/core";
import { bodySchema } from "@/features/editor/schema";
import { extOf, loadPictures, withPageDoc } from "@/features/export/content";
import type { DocNode } from "@/features/export/serialize";
import { saveNow } from "@/features/history/versions";
import { remoteEdit } from "@/features/sync/live";
import { onLocalWrite, storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { fileToBody, noteToFile, splitFront, type Front } from "./convert";
import { forget, read, write } from "./keep";

// Keeps a workspace and a folder of plain Markdown files in step, both ways.
// Every note is a .md file; folders are folders; a book is a folder of
// numbered chapters; pictures go in attachments/. The note's id sits in the
// file's header, so a file renamed or moved in another app stays the same
// note. Edits made in another app come back in, after the note as it was is
// kept as a version, so nothing is lost either way.

export type MirrorView =
  | { state: "off" }
  | { state: "unsupported" }
  | { state: "needs-permission"; folder: string }
  | { state: "on"; folder: string; files: number; checked: number | null; error?: string };

export const mirrorView = createStore<MirrorView>({ state: "showDirectoryPicker" in window || "storage" in navigator ? "off" : "unsupported" });

/** How often to look at the folder for edits made in other apps. */
const LOOK_EVERY_MS = 4000;
const ATTACHMENTS = "attachments";

/** What was last written for a page, to tell another app's edits from our own. */
interface Written {
  path: string;
  /** Hash of the file's text, as last written or read. */
  file: string;
  /** Hash of the title and tags it was written with. */
  front: string;
  /**
   * For a file another app wrote, not edited here since: hash of the body it
   * gave. Such a file is left exactly as that app wrote it, header or not, so
   * syntax Notemax does not know, like an Obsidian callout, is never lost.
   */
  body?: string;
  modified: number;
}

type Handle = FileSystemDirectoryHandle;

const hashOf = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16);
};

const safe = (title: string) => (title || "Untitled").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Untitled";

interface Planned {
  item: TreeItem;
  path: string;
}

/** Where each page goes in the folder, following the sidebar. */
function plan(tree: Tree): Map<string, Planned> {
  const out = new Map<string, Planned>();
  const used = new Set<string>();
  const unique = (path: string) => {
    let candidate = path;
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = path.replace(/(\.[^./]+)$/, ` (${n})$1`);
    used.add(candidate.toLowerCase());
    return candidate;
  };
  const walk = (items: readonly TreeItem[], dir: string, numbered: boolean) => {
    items.forEach((item, i) => {
      const name = (numbered ? `${String(i + 1).padStart(2, "0")} ` : "") + safe(item.title);
      if (item.kind === "folder") return walk(item.children, `${dir}${name}/`, false);
      if (item.kind === "book") return walk(item.children, `${dir}${name}/`, true);
      if (item.kind === "note") out.set(item.id, { item, path: unique(`${dir}${name}.md`) });
      else if (item.kind === "board") out.set(item.id, { item, path: unique(`${dir}${name}.excalidraw`) });
      if (item.children.length) walk(item.children, `${dir}${name}/`, false);
    });
  };
  walk(tree.top, "", false);
  return out;
}

async function folderOf(root: Handle, path: string, create: boolean): Promise<Handle> {
  let dir = root;
  for (const part of path.split("/").slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create });
  return dir;
}
const nameOf = (path: string) => path.split("/").at(-1)!;

async function writeFile(root: Handle, path: string, data: string | Uint8Array): Promise<number> {
  const handle = await (await folderOf(root, path, true)).getFileHandle(nameOf(path), { create: true });
  const out = await handle.createWritable();
  await out.write(data as FileSystemWriteChunkType);
  await out.close();
  return (await handle.getFile()).lastModified;
}

async function removeFile(root: Handle, path: string) {
  try {
    await (await folderOf(root, path, false)).removeEntry(nameOf(path));
  } catch {
    // Gone already, which is what was wanted.
  }
}

/** Every Markdown file in the folder, with its path, leaving out attachments and hidden folders. */
async function listFiles(root: Handle): Promise<Map<string, File>> {
  const out = new Map<string, File>();
  const walk = async (dir: Handle, prefix: string) => {
    for await (const [name, entry] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
      if (name.startsWith(".") || (prefix === "" && name === ATTACHMENTS)) continue;
      if (entry.kind === "directory") await walk(entry as Handle, `${prefix}${name}/`);
      else if (name.toLowerCase().endsWith(".md")) out.set(`${prefix}${name}`, await (entry as FileSystemFileHandle).getFile());
    }
  };
  await walk(root, "");
  return out;
}

function replaceBody(doc: Y.Doc, body: DocNode) {
  const fragment = doc.getXmlFragment("content");
  doc.transact(() => {
    fragment.delete(0, fragment.length);
    prosemirrorJSONToYXmlFragment(bodySchema(), body, fragment);
  });
}

class Mirror {
  private written: Record<string, Written> = {};
  private dirty = new Set<string>();
  private everything = true;
  private stops: (() => void)[] = [];
  private busy: Promise<void> = Promise.resolve();

  constructor(
    private root: Handle,
    private app: AppContext,
  ) {}

  /** The workspace this folder belongs to. Every read and write names it, whatever the sidebar shows. */
  private get ws() {
    return this.app.workspace;
  }

  private tree = () => readTree(this.app.doc);

  private resolver() {
    const tree = this.tree();
    return {
      title: (id: string) => (tree.byId.has(id) ? tree.byId.get(id)!.title || "Untitled" : null),
      image: (asset: string) => `${ATTACHMENTS}/${asset.slice(0, 16)}`,
    };
  }

  private front(item: TreeItem): Front {
    return { id: item.id, title: item.title || "Untitled", tags: item.tags };
  }

  /** The file a page would have now. Pictures get their extension once they are known. */
  private async fileFor(item: TreeItem, pictures: Set<string>): Promise<{ text: string; body: string }> {
    if (item.kind === "board") {
      const format = registry.exporters("board").find((f) => f.id === "excalidraw");
      const blob = format && (await format.build(item, this.app));
      const text = blob ? await blob.text() : "";
      return { text, body: hashOf(text) };
    }
    const body = await withPageDoc(item.id, (doc) => yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")) as DocNode, this.ws);
    const found = await loadPictures([body], undefined, this.ws);
    const r = this.resolver();
    found.forEach((_asset, id) => pictures.add(id));
    const text = noteToFile(this.front(item), body, { ...r, image: (asset) => (found.has(asset) ? `${ATTACHMENTS}/${asset.slice(0, 16)}.${extOf(found.get(asset)!.type)}` : null) });
    return { text, body: hashOf(JSON.stringify(body)) };
  }

  async start() {
    this.written = (await read<Record<string, Written>>("written", this.ws)) ?? {};
    this.stops.push(
      onLocalWrite(({ docId }) => {
        const { workspace, docId: id } = splitScoped(docId);
        if (workspace === this.ws && id !== WORKSPACE_DOC_ID) this.dirty.add(id);
      }),
      remoteEdit.subscribe(() => {
        const edit = remoteEdit.get();
        if (edit) this.dirty.add(edit.docId);
      }),
    );
    const timer = setInterval(() => document.visibilityState === "visible" && this.tick(), LOOK_EVERY_MS);
    this.stops.push(() => clearInterval(timer));
    await this.tick();
  }

  stop() {
    this.stops.forEach((stop) => stop());
    this.stops = [];
  }

  /** One look at the folder, then one write of what changed here. One at a time. */
  tick(): Promise<void> {
    this.busy = this.busy
      .then(async () => {
        await this.bringIn();
        await this.sendOut();
        await write("written", this.ws, this.written);
        mirrorView.set({ state: "on", folder: this.root.name, files: Object.keys(this.written).length, checked: Date.now() });
      })
      .catch((err) => {
        mirrorView.set({ state: "on", folder: this.root.name, files: Object.keys(this.written).length, checked: Date.now(), error: err instanceof Error ? err.message : String(err) });
      });
    return this.busy;
  }

  private async sendOut() {
    const tree = this.tree();
    const planned = plan(tree);
    const pictures = new Set<string>();
    for (const [id, { item, path }] of planned) {
      const before = this.written[id];
      const front = hashOf(JSON.stringify(this.front(item)));
      // A page's file is looked at again only when its text, title, tags or place may have changed.
      if (!this.everything && before?.path === path && before.front === front && !this.dirty.has(id)) continue;
      const { text, body } = await this.fileFor(item, pictures);
      if (before?.body === body && before.path === path && before.front === front) continue;
      const file = hashOf(text);
      if (before?.file === file && before.path === path) {
        before.front = front;
        continue;
      }
      if (before && before.path !== path) await removeFile(this.root, before.path);
      const modified = await writeFile(this.root, path, text);
      this.written[id] = { path, file, front, modified };
    }
    // Pages deleted or trashed here leave the folder too. Their versions stay in the app.
    for (const id of Object.keys(this.written)) {
      if (planned.has(id)) continue;
      await removeFile(this.root, this.written[id].path);
      delete this.written[id];
    }
    if (pictures.size) await this.sendPictures(pictures);
    this.dirty.clear();
    this.everything = false;
  }

  private async sendPictures(ids: Set<string>) {
    const dir = await this.root.getDirectoryHandle(ATTACHMENTS, { create: true });
    const found = await loadPictures([{ type: "doc", content: [...ids].map((asset) => ({ type: "image", attrs: { asset } })) }], undefined, this.ws);
    for (const [id, asset] of found) {
      const name = `${id.slice(0, 16)}.${extOf(asset.type)}`;
      const exists = await dir.getFileHandle(name).then(
        () => true,
        () => false,
      );
      if (!exists) await writeFile(this.root, `${ATTACHMENTS}/${name}`, asset.bytes);
    }
  }

  /** A picture a file points to, kept as an asset. */
  private picture = async (path: string): Promise<string | null> => {
    const handle = await (await folderOf(this.root, path, false)).getFileHandle(nameOf(path));
    const file = await handle.getFile();
    return saveAsset(await storeFor(this.ws), { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type || "image/png", name: file.name });
  };

  private async bringIn() {
    const files = await listFiles(this.root);
    const byPath = new Map(Object.entries(this.written).map(([id, w]) => [w.path, id]));
    for (const [path, file] of files) {
      const known = byPath.get(path);
      if (known && this.written[known].modified === file.lastModified) continue;
      const text = await file.text();
      if (known && this.written[known].file === hashOf(text)) {
        this.written[known].modified = file.lastModified;
        continue;
      }
      const { front, markdown } = splitFront(text);
      const tree = this.tree();
      const id = front.id && tree.byId.has(front.id) && tree.byId.get(front.id)!.deletedAt === null ? front.id : known;
      if (id) await this.takeEdit(id, path, front, markdown, text, file.lastModified);
      else await this.takeNew(path, front, markdown, text, file.lastModified);
    }
    // A file deleted in another app takes its page to the trash, where it can still be restored.
    for (const [path, id] of byPath) {
      if (files.has(path) || path.endsWith(".excalidraw")) continue;
      const node = this.tree().byId.get(id);
      delete this.written[id];
      if (node && node.deletedAt === null) {
        trashNode(this.app.doc, id);
        this.app.notify(`"${node.title || "Untitled"}" was deleted in the folder, so it is in the trash now`);
      }
    }
  }

  /** Another app changed a page's file: keep the page as it was as a version, then take the file's text. */
  private async takeEdit(id: string, path: string, front: Front, markdown: string, text: string, modified: number) {
    const body = await fileToBody(markdown, this.tree(), this.picture);
    const now = await withPageDoc(id, (doc) => Y.encodeStateAsUpdate(doc), this.ws);
    await saveNow(id, now, "Before an edit in another app", this.ws);
    await withPageDoc(id, (doc) => replaceBody(doc, body), this.ws);
    const title = front.title ?? nameOf(path).replace(/\.md$/i, "");
    const node = this.tree().byId.get(id);
    if (node && title && title !== node.title) renameNode(this.app.doc, id, title);
    for (const tag of front.tags ?? []) addTag(this.app.doc, id, tag);
    await this.remember(id, path, text, modified);
  }

  /** A new file: a new page, in folders like the file's. */
  private async takeNew(path: string, front: Front, markdown: string, text: string, modified: number) {
    let parent = ROOT;
    for (const part of path.split("/").slice(0, -1)) {
      const tree = this.tree();
      const siblings = parent === ROOT ? tree.top : (tree.items.get(parent)?.children ?? []);
      parent = siblings.find((item) => item.kind === "folder" && safe(item.title) === part)?.id ?? createNode(this.app.doc, "folder", parent, part);
    }
    const title = front.title ?? nameOf(path).replace(/\.md$/i, "");
    const body = await fileToBody(markdown, this.tree(), this.picture);
    const id = createNode(this.app.doc, "note", parent, title);
    await withPageDoc(id, (doc) => replaceBody(doc, body), this.ws);
    for (const tag of front.tags ?? []) addTag(this.app.doc, id, tag);
    await this.remember(id, path, text, modified);
  }

  /**
   * Notes a file as just read, with the body the page has from it, so the file
   * is not written back until the page changes here.
   */
  private async remember(id: string, path: string, text: string, modified: number) {
    const item = this.tree().items.get(id);
    const body = await withPageDoc(id, (doc) => hashOf(JSON.stringify(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")))), this.ws);
    this.written[id] = { path, file: hashOf(text), front: item ? hashOf(JSON.stringify(this.front(item))) : "", body, modified };
  }
}

let running: Mirror | null = null;
let appNow: AppContext | null = null;
/** Lets go of the lock that keeps the folder to one window, when this one stops keeping it. */
let release: (() => void) | null = null;

function stopRunning() {
  running?.stop();
  running = null;
  release?.();
  release = null;
}

/**
 * Runs the folder the shown workspace keeps, if any: at start, and after each
 * switch. The folder of the workspace left stops, so a Mirror never writes
 * into a workspace it does not belong to. `app` is copied, so its workspace
 * and tree stay that workspace's.
 */
export async function startMirror(live: AppContext) {
  const app = { ...live };
  appNow = app;
  stopRunning();
  mirrorView.set({ state: "off" });
  const root = await read<Handle>("folders", app.workspace);
  if (appNow !== app) return;
  if (!root) return;
  const permitted = (await (root as unknown as { queryPermission(o: object): Promise<string> }).queryPermission({ mode: "readwrite" })) === "granted";
  if (!permitted) return mirrorView.set({ state: "needs-permission", folder: root.name });
  await run(root, app);
}

async function run(root: Handle, app: AppContext) {
  stopRunning();
  mirrorView.set({ state: "on", folder: root.name, files: 0, checked: null });
  const take = async () => {
    running = new Mirror(root, app);
    await running.start();
  };
  // One window per workspace keeps the folder, so two never write the same file.
  if (navigator.locks) void navigator.locks.request(`notemax-markdown-${app.workspace}`, () => take().then(() => new Promise<void>((resolve) => (release = resolve))));
  else await take();
}

/** Starts keeping a folder for this workspace: Choose a folder in Settings, or a test with any directory. */
export async function useFolder(root: Handle) {
  await write("folders", workspaceNow(), root);
  await write("written", workspaceNow(), {});
  if (appNow) await run(root, appNow);
}

/** Asks again for the folder, after the browser forgot the permission. Must run from a click. */
export async function allowAgain() {
  const root = await read<Handle>("folders", workspaceNow());
  if (!root || !appNow) return;
  const answer = await (root as unknown as { requestPermission(o: object): Promise<string> }).requestPermission({ mode: "readwrite" });
  if (answer === "granted") await run(root, appNow);
}

/** Stops keeping the folder. The files stay where they are. */
export async function stopFolder() {
  stopRunning();
  await forget("folders", workspaceNow());
  await forget("written", workspaceNow());
  mirrorView.set({ state: "off" });
}

export const checkNow = () => running?.tick();

/** Picks a folder with the system dialog. Null when the person cancels. */
export async function pickFolder(): Promise<Handle | null> {
  try {
    return await (window as unknown as { showDirectoryPicker(o: object): Promise<Handle> }).showDirectoryPicker({ mode: "readwrite" });
  } catch {
    return null;
  }
}

/** Saves a folder to be kept by a workspace that is not open yet, like a new one made from a vault. */
export const keepFolderFor = (workspace: string, root: Handle) => write("folders", workspace, root);
