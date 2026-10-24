import * as Y from "yjs";
import { ROOT, STARTER, createNode, setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { holder, setRole } from "@/features/special/roles";
import { titleFor } from "@/features/special/titles";
import { storeFor } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";

// A page can carry a date (its "date" setting, like 2026-10-22), which puts it
// on the calendar. A daily note is a note made for a day: its "daily" setting
// holds the day, and it lives in the page chosen for daily notes (Settings,
// Special pages), or in a Journal page that shows each day as a subtopic.

const DATE = "date";
const DAILY = "daily";

/** A day as YYYY-MM-DD in local time, the form dates are kept in. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const todayKey = () => dayKey(new Date());
export const dayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const isDayKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const dateOf = (node: TreeNode) => (isDayKey(node.props[DATE]) ? (node.props[DATE] as string) : isDayKey(node.props[DAILY]) ? (node.props[DAILY] as string) : null);
export const setDate = (app: AppContext, id: string, key: string | null) => setProp(app.doc, id, DATE, key);

/** Pages with a date, by day, daily notes first. Trashed ones are left out. */
export function pagesByDay(tree: Tree): Map<string, TreeItem[]> {
  const out = new Map<string, TreeItem[]>();
  for (const item of tree.items.values()) {
    const key = dateOf(item);
    if (!key) continue;
    out.set(key, [...(out.get(key) ?? []), item]);
  }
  for (const list of out.values()) list.sort((a, b) => Number(isDayKey(b.props[DAILY])) - Number(isDayKey(a.props[DAILY])));
  return out;
}

export const dailyNote = (tree: Tree, key: string) => [...tree.items.values()].find((item) => item.props[DAILY] === key);

/** Where daily notes go: the page chosen for them, or a new Journal page at the top with each day inside it. */
function dailyPlace(app: AppContext): string {
  const chosen = holder(app.tree, "dailyFolder");
  if (chosen) return chosen.id;
  const id = createNode(app.doc, "note", ROOT, "Journal", app.tree.byId.has(STARTER.journal) ? crypto.randomUUID() : STARTER.journal);
  setRole(app.doc, app.tree, "dailyFolder", id);
  setProp(app.doc, id, "subtopics", "inline");
  setProp(app.doc, id, "sort", "days");
  return id;
}

/**
 * Makes the note for a day, as a copy of the template when there is one, and
 * returns its id. The id comes from the day, so two devices that both start
 * today's note end up with one note once they sync, not two.
 */
export async function makeDay(app: AppContext, key: string): Promise<string> {
  const found = dailyNote(app.tree, key);
  if (found) return found.id;
  const id = app.tree.byId.has(`day-${key}`) ? crypto.randomUUID() : `day-${key}`;
  const template = holder(app.tree, "dailyTemplate");
  if (template) {
    // The body goes first, so the note never opens empty. Open templates give their last keystrokes too.
    await peekDoc(template.id, app.workspace)?.flush();
    const store = await storeFor(app.workspace);
    const { updates } = await store.load(template.id);
    if (updates.length) await store.append(id, Y.mergeUpdates(updates));
  }
  createNode(app.doc, "note", dailyPlace(app), titleFor(dayOf(key)), id);
  setProp(app.doc, id, DAILY, key);
  return id;
}

/** Opens the note for a day, making it first if there is none. */
export async function openDay(app: AppContext, key: string, where?: { newTab?: boolean }) {
  app.open(await makeDay(app, key), where);
}

/** A new page dated a day, at the top level, opened to be named. */
export function addPageOn(app: AppContext, key: string) {
  const id = createNode(app.doc, "note", ROOT);
  setDate(app, id, key);
  app.open(id);
}

/**
 * A new workspace's Journal starts with today's entry, once. The mark lives on
 * the Journal itself, so it syncs, and deleting the entry does not bring it back.
 */
export async function startJournal(app: AppContext) {
  const journal = app.tree.items.get(STARTER.journal);
  if (!journal || journal.kind !== "note" || journal.props.journalStarted === true || journal.props.dailyFolder !== true) return;
  setProp(app.doc, journal.id, "journalStarted", true);
  if (!dailyNote(app.tree, todayKey())) await makeDay(app, todayKey());
}

/** Daily notes, the newest day first. */
export function dailyNotes(tree: Tree): { key: string; item: TreeItem }[] {
  const out: { key: string; item: TreeItem }[] = [];
  for (const item of tree.items.values()) if (isDayKey(item.props[DAILY])) out.push({ key: item.props[DAILY] as string, item });
  return out.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

export const shiftDay = (key: string, days: number) => {
  const date = dayOf(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};
