import { MAIN_WORKSPACE, setWorkspaceLocked, type WorkspaceInfo } from "@notemax/core";
import { relock } from "@/features/lock/lock";
import { workspaceNow } from "@/platform/prefs";
import type { AppContext } from "@/plugins/types";
import { ConfirmDialog } from "@/ui/Dialog";
import { messageOf, plural } from "@/ui/format";
import { deleteWorkspace, nameOf, openList, switchTo, workspaceList } from "./list";

/** The first workspace holds pages from before workspaces existed, so it always stays. */
export const canDelete = (workspace: WorkspaceInfo) => workspace.id !== MAIN_WORKSPACE;

/** Locks a workspace at once, or takes its lock off. Taking it off needs the password typed first. */
export async function setLock(app: AppContext, workspace: WorkspaceInfo, on: boolean) {
  const local = await openList();
  setWorkspaceLocked(local.doc, workspace.id, on);
  await local.flush();
  if (on) {
    relock(app);
    app.notify(`Locked ${nameOf(workspace)}. The lock password opens it.`);
  }
}

/**
 * Asks before erasing a workspace, with its name typed out, since nothing
 * brings it back. The open one makes way for another first.
 */
export function DeleteWorkspaceDialog({ workspace, app, count, onClose }: { workspace: WorkspaceInfo; app: AppContext; count: number | null; onClose(): void }) {
  const name = nameOf(workspace);
  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      message={
        <>
          <strong>{name}</strong> and its {count === null ? "pages" : plural(count, "page")} will be erased from this device and, through sync, from your other devices. This cannot be undone.
        </>
      }
      confirmLabel="Delete workspace"
      typeToConfirm={name}
      onCancel={onClose}
      onConfirm={() => {
        onClose();
        if (workspaceNow() === workspace.id) switchTo(workspaceList.get().find((w) => w.id !== workspace.id)?.id ?? MAIN_WORKSPACE);
        void deleteWorkspace(workspace.id)
          .then(() => app.notify(`Deleted ${name}`))
          .catch((error: unknown) => app.notify(`Could not delete ${name}: ${messageOf(error)}`));
      }}
    />
  );
}
