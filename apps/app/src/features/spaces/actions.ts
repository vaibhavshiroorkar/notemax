import { MAIN_WORKSPACE, addWorkspace, exportKey, readTree, setWorkspaceShared, type WorkspaceInfo } from "@notemax/core";
import { shareOf, stopSharing } from "@/features/share/share";
import { deleteWorkspace, nameOf, openList, switchTo, workspaceList } from "@/features/workspaces/list";
import { copyWorkspace } from "@/features/workspaces/transfer";
import { isDesktop } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { messageOf } from "@/ui/format";
import { dismissToast, showToast } from "@/ui/toast";
import { createSpace, deleteSpace, openSpace, uninvite } from "./api";
import { forgetSpaceState, spaceViews } from "./runtime";

/** Where people without the app open a link. The desktop app has no address of its own. */
const PUBLIC_APP = "https://notemax.pages.dev";

/** The link anyone may open, as the link setting allows. */
export const linkTo = (space: string, token: string) => `${isDesktop ? PUBLIC_APP : location.origin}/#space=${space}.${token}`;

const mark = async (workspace: string, shared: { space: string; token: string | null } | null) => {
  const local = await openList();
  setWorkspaceShared(local.doc, workspace, shared);
  await local.flush();
};

/**
 * Starts sharing a workspace. Its pages go up on the next sync, from this
 * device. One never named is "My notes" only to its owner, so the others see
 * whose notes it is.
 */
export async function shareWorkspace(workspace: WorkspaceInfo, ownerName = "") {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const name = workspace.name || (ownerName ? `${ownerName.split(" ")[0]}'s notes` : "Shared notes");
  const { id } = await createSpace(name, await exportKey(key));
  forgetSpaceState(id);
  await mark(workspace.id, { space: id, token: null });
}

/** Stops sharing: the copy on the server goes, and the workspace here becomes a private one again. */
export async function stopSharingWorkspace(workspace: WorkspaceInfo) {
  if (!workspace.shared) return;
  await deleteSpace(workspace.shared.space);
  forgetSpaceState(workspace.shared.space);
  await mark(workspace.id, null);
}

/**
 * Takes a shared workspace off this person's list and erases its pages from
 * their devices. An invited person is also taken off the list of people.
 */
export async function leaveWorkspace(workspace: WorkspaceInfo, email: string | null) {
  const shared = workspace.shared;
  if (shared && email) await uninvite(shared.space, shared.token, email).catch(() => {});
  if (workspaceNow() === workspace.id) switchTo(workspaceList.get().find((w) => w.id !== workspace.id)?.id ?? MAIN_WORKSPACE);
  if (shared) forgetSpaceState(shared.space);
  await deleteWorkspace(workspace.id);
}

/**
 * Opens a shared workspace: the one already on this device, or a new one that
 * fills in from the server. Its id here is the shared id, so every device of
 * the same person lands on the same workspace.
 */
export async function joinSpace(space: string, token: string | null): Promise<{ workspace: string; name: string } | null> {
  const here = workspaceList.get().find((w) => w.shared?.space === space);
  if (here) {
    // A link adds what an invitation alone may not give, like reading without signing in.
    if (token && here.shared?.token !== token) await mark(here.id, { space, token });
    switchTo(here.id);
    return { workspace: here.id, name: nameOf(here) };
  }
  const info = await openSpace(space, token);
  if (!info) return null;
  const local = await openList();
  addWorkspace(local.doc, info.name || "Shared workspace", "", space);
  setWorkspaceShared(local.doc, space, { space, token });
  await local.flush();
  forgetSpaceState(space);
  switchTo(space);
  return { workspace: space, name: info.name || "Shared workspace" };
}

/** A shared workspace link this window was opened with. Read once, then taken out of the address. */
export const spaceFromLink: { space: string; token: string } | null = (() => {
  const value = new URLSearchParams(location.hash.slice(1)).get("space") ?? "";
  const match = /^([0-9a-f-]{36})\.([0-9a-f]{20,128})$/i.exec(value);
  if (!match) return null;
  history.replaceState(history.state, "", location.pathname + location.search);
  return { space: match[1].toLowerCase(), token: match[2] };
})();

export const COPY_HINT = "A new workspace with every page as it is now, only for you to change. It does not follow later changes, and nobody else sees it.";

/** Whether to offer a private copy: to the people a workspace is shared with, not to its owner, who has the original. */
export function canCopy(workspace: WorkspaceInfo): boolean {
  if (!workspace.shared) return false;
  const view = spaceViews.get()[workspace.id];
  return view?.state !== "ready" || view.info.role !== "owner";
}

/** Shared workspaces being copied right now, so their buttons can show it. */
export const copying = createStore<ReadonlySet<string>>(new Set());

/** How long to wait for pages still arriving before copying what is here. */
const SETTLE_MS = 60_000;

/** Resolves once this window is not reading the workspace's pages, or after a while. */
function settled(workspace: string): Promise<void> {
  const busy = () => {
    const view = spaceViews.get()[workspace];
    return view?.state === "opening" || (view?.state === "ready" && view.sync?.state === "syncing");
  };
  if (!busy()) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      stop();
      resolve();
    };
    const timer = setTimeout(done, SETTLE_MS);
    const stop = spaceViews.subscribe(() => !busy() && done());
  });
}

/**
 * Makes a private copy of a shared workspace, so someone who may only view it
 * can still change their own version. The copy is theirs alone: it is not
 * shared, and pages in it that were shared on their own by link lose that
 * link, so nothing typed in the copy reaches the original.
 */
export async function copySharedWorkspace(workspace: WorkspaceInfo): Promise<{ workspace: string; name: string }> {
  const set = (on: boolean) => {
    const next = new Set(copying.get());
    if (on) next.add(workspace.id);
    else next.delete(workspace.id);
    copying.set(next);
  };
  set(true);
  try {
    await settled(workspace.id);
    const name = `${nameOf(workspace)} (copy)`;
    const id = await copyWorkspace(workspace.id, name, workspace.color, (tree) => {
      tree.transact(() => {
        for (const node of readTree(tree).byId.values()) if (shareOf(node)) stopSharing(tree, node.id);
      });
    });
    return { workspace: id, name };
  } finally {
    set(false);
  }
}

/** Copies a shared workspace and says so, with a button to go there. */
export function startCopy(workspace: WorkspaceInfo) {
  if (copying.get().has(workspace.id)) return;
  const working = showToast(`Copying ${nameOf(workspace)}...`);
  copySharedWorkspace(workspace)
    .finally(() => dismissToast(working))
    .then(
      (copy) => showToast(`Made ${copy.name}. It is yours to change, and nobody else sees it.`, { label: "Open it", run: () => switchTo(copy.workspace) }),
      (err: unknown) => showToast(`Could not make a copy: ${messageOf(err)}`),
    );
}
