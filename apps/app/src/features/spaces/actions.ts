import { MAIN_WORKSPACE, addWorkspace, exportKey, setWorkspaceShared, type WorkspaceInfo } from "@notemax/core";
import { deleteWorkspace, nameOf, openList, switchTo, workspaceList } from "@/features/workspaces/list";
import { isDesktop } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { createSpace, deleteSpace, openSpace, uninvite } from "./api";
import { forgetSpaceState } from "./runtime";

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
