import type { ReactNode } from "react";
import type { TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { nameOf, workspaceList } from "@/features/workspaces/list";
import { isLocked, relock, unlocked } from "./lock";
import { LockScreen } from "./LockScreen";

/** A locked page, or any page of a locked workspace, shows the lock screen until the password is typed. */
export function LockGate({ node, app, children }: { node: TreeNode; app: AppContext; children: ReactNode }) {
  const open = unlocked.use();
  const workspace = workspaceList.use().find((w) => w.id === app.workspace);
  if (open || (!isLocked(node) && !workspace?.locked)) return children;
  return <LockScreen title={isLocked(node) ? node.title || "Untitled" : workspace ? nameOf(workspace) : "This workspace"} app={app} />;
}

/** Under the title of a locked page that is open: a way to lock it again at once. */
export function LockLine({ node, app }: { node: TreeNode; app: AppContext }) {
  const open = unlocked.use();
  if (!isLocked(node) || !open) return null;
  return (
    <p className="lock-line">
      <Icon name="lock" />
      <span>Locked page, open for now.</span>
      <button className="link-button" onClick={() => relock(app)}>
        Lock again
      </button>
    </p>
  );
}
