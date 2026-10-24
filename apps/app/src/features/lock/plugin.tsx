import type { ContextTarget, Plugin } from "@/plugins/types";
import { isHidden, isLocked, relock, setLocked, unlocked, watchIdle } from "./lock";
import { LockGate, LockLine } from "./LockGate";
import { LockSection } from "./LockSection";
import "./lock.css";

const nodeOf = (target: ContextTarget) => (target.type === "page" && target.node.kind !== "folder" ? target.node : null);

export const lockPlugin: Plugin = {
  id: "lock",
  name: "Page lock",
  description: "A password before chosen pages show",
  pageGates: [{ id: "lock.gate", applies: isLocked, component: LockGate }],
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
  commands: [{ id: "lock.now", title: "Lock pages now", keywords: ["lock", "hide", "private", "password"], when: () => unlocked.get(), run: (app) => relock(app) }],
  start: (app) => void watchIdle(app),
};
