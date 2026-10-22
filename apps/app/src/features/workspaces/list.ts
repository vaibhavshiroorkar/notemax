import {
  MAIN_WORKSPACE,
  WORKSPACES_DOC_ID,
  WORKSPACE_DOC_ID,
  addWorkspace,
  moveWorkspace,
  openLocalDoc,
  readTree,
  readWorkspaces,
  removeWorkspace,
  renameWorkspace,
  scopedId,
  setWorkspaceColor,
  splitScoped,
  type LocalDoc,
  type WorkspaceInfo,
} from "@notemax/core";
import { WORKSPACES_CHANNEL, getRawStore, getSharedStore } from "@/platform/platform";
import { currentWorkspace, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";

/** Every workspace, kept current as the list changes here or on another device. */
export const workspaceList = createStore<WorkspaceInfo[]>([]);

/** Colors to tell workspaces apart, readable on light and dark. */
export const WORKSPACE_COLORS = ["", "#e03131", "#e8590c", "#f08c00", "#2f9e44", "#1c7ed6", "#9c36b5", "#d6336c", "#868e96"];

export const nameOf = (workspace: WorkspaceInfo) => workspace.name || (workspace.id === MAIN_WORKSPACE ? "My notes" : "Untitled workspace");

let opened: Promise<LocalDoc> | null = null;

/** Opens the list once for this window. */
export function openList(): Promise<LocalDoc> {
  opened ??= getSharedStore()
    .then((store) => openLocalDoc(store, WORKSPACES_DOC_ID, { broadcast: WORKSPACES_CHANNEL }))
    .then((local) => {
      const refresh = () => workspaceList.set(readWorkspaces(local.doc));
      refresh();
      local.doc.on("update", refresh);
      return local;
    });
  return opened;
}

const change = async (edit: (doc: LocalDoc["doc"]) => void) => {
  const local = await openList();
  edit(local.doc);
  await local.flush();
};

/** Shows another workspace. The window starts over in it, with that workspace's own tabs. */
export function switchTo(id: string) {
  if (id === currentWorkspace) return;
  setPref("workspace", id);
  // Without the page in the address: it belongs to the workspace being left.
  location.assign(location.pathname);
}

export async function createWorkspace(name: string, color = ""): Promise<string> {
  let id = "";
  await change((doc) => (id = addWorkspace(doc, name, color)));
  return id;
}

export const rename = (id: string, name: string) => change((doc) => renameWorkspace(doc, id, name));
export const recolor = (id: string, color: string) => change((doc) => setWorkspaceColor(doc, id, color));
export const move = (id: string, index: number) => change((doc) => moveWorkspace(doc, id, index));

/** Erases a workspace and every page in it, here and, through sync, on other devices. */
export async function deleteWorkspace(id: string) {
  if (id === MAIN_WORKSPACE || id === currentWorkspace) throw new Error("switch to another workspace first");
  const store = await getSharedStore();
  for (const stored of await store.list()) if (splitScoped(stored).workspace === id) await store.remove(stored);
  await change((doc) => removeWorkspace(doc, id));
}

/** How many pages a workspace has, read without opening it. */
export async function pageCount(id: string): Promise<number> {
  const local = await openLocalDoc(await getRawStore(), scopedId(id, WORKSPACE_DOC_ID));
  try {
    return readTree(local.doc).visible.size;
  } finally {
    await local.close();
  }
}
