import type { ContextTarget, Plugin } from "@/plugins/types";
import { isHidden, isLocked, relock, setLocked, unlocked, watchIdle } from "./lock";
import { LockGate, LockLine } from "./LockGate";
import { LockSection } from "./LockSection";
import "./lock.css";

const nodeOf = (target: ContextTarget) => (target.type === "page" && target.node.kind !== "folder" ? target.node : null);

export const lockPlugin: Plugin = {
  id: "lock",
  name: "Lock",
  description: "A password before chosen pages or workspaces show",
  // Every page goes through, since locking a workspace must close pages already open; the gate decides as it draws.
  pageGates: [{ id: "lock.gate", applies: () => true, component: LockGate }],
  hidesText: isHidden,
  pageHeader: [{ id: "lock.line", component: LockLine }],
  rowMarks: [{ id: "lock.locked", icon: "lock", label: "Locked", when: isLocked }],
  settings: [{ id: "privacy", order: 85, group: "Your data", title: "Privacy", icon: "lock", keywords: ["lock", "password", "private", "hide"], component: LockSection }],
  contextMenu: [
    {
      id: "lock.on",
      inside: "options",
      title: "Lock page",
      group: "layout",
      icon: "lock",
      targets: ["page"],
      when: (target) => !!nodeOf(target) && !isLocked(nodeOf(target)!),
      run: (target, app) => setLocked(app, nodeOf(target)!.id, true),
    },
    {
      id: "lock.off",
      inside: "options",
      title: "Remove the lock",
      group: "layout",
      icon: "lock",
      targets: ["page"],
      // Only with the page open: taking a lock off needs the password.
      when: (target) => !!nodeOf(target) && isLocked(nodeOf(target)!) && unlocked.get(),
      run: (target, app) => setLocked(app, nodeOf(target)!.id, false),
    },
  ],
  commands: [{ id: "lock.now", title: "Lock now", keywords: ["lock", "hide", "private", "password", "workspace"], when: () => unlocked.get(), run: (app) => relock(app) }],
  start: (app) => void watchIdle(app),
};
