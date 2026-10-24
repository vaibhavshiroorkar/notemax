import { remindAt } from "@notemax/core";
import { indexVersion } from "@/features/search/text-index";
import { isDesktop } from "@/platform/platform";
import { getPref, setPref } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { entries, type Entry } from "./list";
import { whenLabel } from "./when";

// Reminders for to-dos with a day and, usually, a time. While the app runs
// (on the desktop it lives in the tray, so that is most of the time), one
// timer waits for the next reminder. A reminder missed while the app was
// closed rings at the next start, if it is less than a day old. Each rings
// once: what rang and what was snoozed is kept on this device.

const FIRED = "remindersFired";
const SNOOZED = "remindersSnoozed";
/** Older than this, a missed reminder is let go quietly. */
const MISSED_FOR = 24 * 60 * 60 * 1000;
/** Timers are set at most this far ahead, then the list is read again. */
const LOOK_AHEAD = 60 * 60 * 1000;

export interface Ring {
  key: string;
  entry: Entry;
  at: number;
}

/** Reminders ringing now, shown as cards in the window until answered. */
export const ringing = createStore<Ring[]>([]);

function readMap(pref: string): Record<string, number> {
  try {
    const value = JSON.parse(getPref(pref) ?? "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function writeMap(pref: string, map: Record<string, number>) {
  // Old marks go, so the list never grows without end.
  const keep = Date.now() - 30 * MISSED_FOR;
  setPref(pref, JSON.stringify(Object.fromEntries(Object.entries(map).filter(([, at]) => at > keep))));
}

/** Names one ringing of one to-do. The day and time are in it, so the next time of a repeating one rings again. */
const keyOf = (workspace: string, { noteId, task }: Entry) => [workspace, noteId, task.id, task.due, task.time, task.remind].join("|");

/** Sends the reminder to the system, so it shows over other apps. */
async function tellSystem(app: AppContext, ring: Ring) {
  const title = ring.entry.task.text;
  const body = [whenLabel(ring.entry.task), app.tree.byId.get(ring.entry.noteId)?.title].filter(Boolean).join(" - ");
  try {
    if (isDesktop) {
      const notification = await import("@tauri-apps/plugin-notification");
      if (!(await notification.isPermissionGranted()) && (await notification.requestPermission()) !== "granted") return;
      notification.sendNotification({ title, body });
      return;
    }
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const shown = new Notification(title, { body, tag: ring.key });
    shown.onclick = () => {
      window.focus();
      app.open(ring.entry.noteId);
      shown.close();
    };
  } catch (err) {
    console.warn("[notemax] could not show a reminder", err);
  }
}

function ring(app: AppContext, found: Ring) {
  const fired = readMap(FIRED);
  fired[found.key] = Date.now();
  writeMap(FIRED, fired);
  if (ringing.get().some((r) => r.key === found.key)) return;
  ringing.set([...ringing.get(), found]);
  void tellSystem(app, found);
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Rings what is due, and sets a timer for the next one. Called at start and whenever the to-dos change. */
export function check(app: AppContext, now = Date.now()) {
  clearTimeout(timer);
  const fired = readMap(FIRED);
  const snoozed = readMap(SNOOZED);
  let next = Infinity;
  let quietlyMissed = false;
  for (const entry of entries(app.tree)) {
    if (!entry.task.id) continue;
    const key = keyOf(app.workspace, entry);
    if (fired[key]) continue;
    const at = snoozed[key] ?? remindAt(entry.task);
    if (at === null) continue;
    if (at > now) next = Math.min(next, at);
    else if (now - at < MISSED_FOR) ring(app, { key, entry, at });
    else {
      fired[key] = now;
      quietlyMissed = true;
    }
  }
  if (quietlyMissed) writeMap(FIRED, fired);
  if (next !== Infinity) timer = setTimeout(() => check(app), Math.min(next - now, LOOK_AHEAD) + 50);
}

/** Rings again later: in some minutes, or at 9 tomorrow morning. */
export function snooze(ring: Ring, until: number) {
  const snoozed = readMap(SNOOZED);
  snoozed[ring.key] = until;
  writeMap(SNOOZED, snoozed);
  const fired = readMap(FIRED);
  delete fired[ring.key];
  writeMap(FIRED, fired);
  dismiss(ring);
}

export const dismiss = (ring: Ring) => ringing.set(ringing.get().filter((r) => r.key !== ring.key));

export const tomorrowMorning = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9).getTime();

/** Asks the browser for leave to show reminders. Needs a click or key press to ask. */
export async function askToNotify(): Promise<boolean> {
  if (isDesktop) return true;
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

let soon: ReturnType<typeof setTimeout> | undefined;
let stopWatching: (() => void) | undefined;

/** Starts watching the to-dos of the shown workspace, in place of the one watched before. */
export function startReminders(app: AppContext) {
  stopWatching?.();
  check(app);
  stopWatching = indexVersion.subscribe(() => {
    // Waits for the index to settle, so a burst of reads checks once.
    clearTimeout(soon);
    soon = setTimeout(() => check(app), 300);
  }) as () => void;
}
