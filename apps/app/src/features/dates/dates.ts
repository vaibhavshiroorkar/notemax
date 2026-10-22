import { ROOT, createNode, setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";

// A page can carry a date (its "date" setting, like 2026-10-22), which puts it
// on the calendar. A daily note is a note made for a day: its "daily" setting
// holds the day, and it lives in a folder of its own.

const DATE = "date";
const DAILY = "daily";
const DAILY_FOLDER = "dailyFolder";

/** A day as YYYY-MM-DD in local time, the form dates are kept in. */
export const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const todayKey = () => dayKey(new Date());
export const dayOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const isDayKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

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

const dailyNote = (tree: Tree, key: string) => [...tree.items.values()].find((item) => item.props[DAILY] === key);

/** The folder daily notes go in: the one marked so, or a new "Daily notes" at the top. */
function dailyFolder(app: AppContext): string {
  const marked = [...app.tree.items.values()].find((item) => item.kind === "folder" && item.props[DAILY_FOLDER] === true);
  if (marked) return marked.id;
  const id = createNode(app.doc, "folder", ROOT, "Daily notes");
  setProp(app.doc, id, DAILY_FOLDER, true);
  return id;
}

/** Opens the note for a day, making it first if there is none. */
export function openDay(app: AppContext, key: string, where?: { newTab?: boolean }) {
  const found = dailyNote(app.tree, key);
  if (found) return app.open(found.id, where);
  const id = createNode(app.doc, "note", dailyFolder(app), key);
  setProp(app.doc, id, DAILY, key);
  app.open(id, where);
}

export const shiftDay = (key: string, days: number) => {
  const date = dayOf(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};
