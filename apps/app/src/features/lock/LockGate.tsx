import type { ReactNode } from "react";
import type { TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { isLocked, relock, unlocked } from "./lock";
import { LockScreen } from "./LockScreen";

/** A locked page shows the lock screen until the password is typed. */
export function LockGate({ node, app, children }: { node: TreeNode; app: AppContext; children: ReactNode }) {
  const open = unlocked.use();
  return open ? children : <LockScreen node={node} app={app} />;
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
