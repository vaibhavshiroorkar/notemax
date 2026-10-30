import * as Y from "yjs";
import { ROOT, UNTRACKED, logEvent, type AuditAction, type AuditEntry, type Author } from "@notemax/core";
import { accountView } from "@/features/account/session";
import { deviceId, deviceLabel } from "@/platform/device";
import { storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";

// The app's side of who did what (core's audit.ts keeps the record): who this
// copy is, the things done to a page that the log keeps, and how to say them.

/** Who is making changes here: the account's name when signed in, and this device. */
export const me = (): Author => {
  const view = accountView.get();
  return { name: view.state === "in" ? view.name : "", device: deviceLabel(), deviceId: deviceId() };
};

/** Goes up whenever a page's versions or log change, so the lists read them again. */
export const historyChanged = createStore(0);
export const markHistoryChanged = () => historyChanged.set(historyChanged.get() + 1);

// A page's versions and log are one doc. Two writes to it at once in one
// window would each open their own copy, and the later save could leave out
// the earlier one's addition, so they wait their turn.
const queues = new Map<string, Promise<unknown>>();

/** Runs `task` once every earlier write to this page's history has finished. */
export function onHistory<T>(workspace: string, pageId: string, task: () => Promise<T>): Promise<T> {
  const key = `${workspace}\n${pageId}`;
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
  queues.set(key, next);
  const done = () => {
    if (queues.get(key) === next) queues.delete(key);
  };
  next.then(done, done);
  return next;
}

/** Adds something done to a page to its log. Never throws: a log that could not be written must not stop the change. */
export function logPage(pageId: string, action: AuditAction, detail: string | null = null, workspace = workspaceNow()): Promise<void> {
  if (!registry.isOn("history")) return Promise.resolve();
  return onHistory(workspace, pageId, async () => logEvent(await storeFor(workspace), pageId, { who: me(), action, detail }))
    .then(markHistoryChanged)
    .catch((err) => console.warn("[notemax] could not add to the page's log", pageId, err));
}

const quoted = (title: string) => `"${title || "Untitled"}"`;

/** The log entry as a sentence, after the name of who did it. */
export function whatHappened(entry: Pick<AuditEntry, "action" | "detail">): string {
  switch (entry.action) {
    case "created":
      return "created the page";
    case "renamed":
      return `renamed it ${entry.detail ?? ""}`.trim();
    case "moved":
      return `moved it ${entry.detail ?? ""}`.trim();
    case "trashed":
      return "moved it to the trash";
    case "untrashed":
      return "took it out of the trash";
    case "saved-version":
      return "saved a version";
    case "restored-version":
      return entry.detail ? `restored the version from ${entry.detail}` : "restored an earlier version";
    case "kept-conflict":
      return entry.detail ? `kept ${entry.detail} after edits on two devices` : "settled edits from two devices";
    case "shared":
      return "shared it";
    case "unshared":
      return "stopped sharing it";
    case "locked":
      return "locked it";
    case "unlocked":
      return "unlocked it";
    default:
      return "changed it";
  }
}

/** A person as the log names them: you on this device, a name, or the device when there is no name. */
export function whoIs(author: Author): { name: string; device: string } {
  if (author.deviceId === deviceId()) return { name: "You", device: "this device" };
  return { name: author.name || author.device, device: author.name ? author.device : "" };
}

/** An exact time, for the log: "Today, 3:04 PM" reads wrong once it is tomorrow. */
export const stampOf = (time: number) => new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

const watched = new WeakSet<Y.Doc>();
/** Typing a title changes it with each key; one entry for the whole rename, once typing stops. */
const RENAME_SETTLES = 3000;

/**
 * Logs what this window does to the pages in a workspace's tree: making one,
 * renaming, moving it to another folder, the trash, sharing and locking.
 * Changes that arrived from other devices are theirs to log, and they do.
 */
export function watchTree(doc: Y.Doc, workspace: string) {
  if (watched.has(doc)) return;
  watched.add(doc);
  const nodes = doc.getMap<Y.Map<unknown>>("nodes");
  const titleOf = (id: string) => (nodes.get(id)?.get("title") as string | undefined) ?? "";
  const renames = new Map<string, { from: string; to: string; timer: number }>();

  const flushRename = (id: string) => {
    const rename = renames.get(id);
    renames.delete(id);
    if (!rename || rename.from === rename.to) return;
    // Naming a page just made is part of making it, not a rename.
    const made = nodes.get(id)?.get("createdAt") as number | undefined;
    if (!rename.from && made && Date.now() - made < 10 * 60_000) return;
    void logPage(id, "renamed", `from ${quoted(rename.from)} to ${quoted(rename.to)}`, workspace);
  };
  window.addEventListener("pagehide", () => [...renames.keys()].forEach(flushRename));

  nodes.observeDeep((events, transaction) => {
    if (!transaction.local || transaction.origin === UNTRACKED || !registry.isOn("history")) return;
    const added: string[] = [];
    for (const event of events) {
      if (event.target === nodes) {
        event.changes.keys.forEach((change, id) => change.action === "add" && added.push(id));
        continue;
      }
      const id = event.path[0];
      if (typeof id !== "string" || !(event instanceof Y.YMapEvent)) continue;
      const fields = nodes.get(id);
      event.changes.keys.forEach((change, key) => {
        const now = fields?.get(key);
        const before = change.oldValue as unknown;
        if (key === "title") {
          const pending = renames.get(id);
          if (pending) window.clearTimeout(pending.timer);
          const rename = pending ?? { from: typeof before === "string" ? before : "", to: "", timer: 0 };
          rename.to = typeof now === "string" ? now : "";
          rename.timer = window.setTimeout(() => flushRename(id), RENAME_SETTLES);
          renames.set(id, rename);
        } else if (key === "parentId" && change.action === "update" && before !== now) {
          void logPage(id, "moved", now === ROOT ? "to the top level" : `into ${quoted(titleOf(now as string))}`, workspace);
        } else if (key === "deletedAt") {
          if (before == null && now != null) void logPage(id, "trashed", null, workspace);
          else if (before != null && now == null) void logPage(id, "untrashed", null, workspace);
        } else if (key === "prop:share") {
          void logPage(id, now ? "shared" : "unshared", null, workspace);
        } else if (key === "prop:locked") {
          void logPage(id, now ? "locked" : "unlocked", null, workspace);
        }
      });
    }
    // One page made by hand. Many at once are an import or a copy, and a log for each would only add weight.
    if (added.length === 1) void logPage(added[0], "created", null, workspace);
  });
}
