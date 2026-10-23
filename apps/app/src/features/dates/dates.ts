import * as Y from "yjs";
import { ROOT, createNode, setProp, type Tree, type TreeItem, type TreeNode } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { holder, setRole } from "@/features/special/roles";
import { titleFor } from "@/features/special/titles";
import { getStore } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";

// A page can carry a date (its "date" setting, like 2026-10-22), which puts it
// on the calendar. A daily note is a note made for a day: its "daily" setting
// holds the day, and it lives in the page chosen for daily notes (Settings,
// Special pages), or in a folder of its own.

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

const dailyNote = (tree: Tree, key: string) => [...tree.items.values()].find((item) => item.props[DAILY] === key);

/** Where daily notes go: the page chosen for them, or a new "Daily notes" folder at the top. */
function dailyPlace(app: AppContext): string {
  const chosen = holder(app.tree, "dailyFolder");
  if (chosen) return chosen.id;
  const id = createNode(app.doc, "folder", ROOT, "Daily notes");
  setRole(app.doc, app.tree, "dailyFolder", id);
  // By title, so the days read in date order whatever order they were made in.
  setProp(app.doc, id, "sort", "title");
  return id;
}

/** Opens the note for a day, making it first if there is none, as a copy of the template when there is one. */
export async function openDay(app: AppContext, key: string, where?: { newTab?: boolean }) {
  const found = dailyNote(app.tree, key);
  if (found) return app.open(found.id, where);
  const id = crypto.randomUUID();
  const template = holder(app.tree, "dailyTemplate");
  if (template) {
    // The body goes first, so the note never opens empty. Open templates give their last keystrokes too.
    await peekDoc(template.id)?.flush();
    const store = await getStore();
    const { updates } = await store.load(template.id);
    if (updates.length) await store.append(id, Y.mergeUpdates(updates));
  }
  createNode(app.doc, "note", dailyPlace(app), titleFor(dayOf(key)), id);
  setProp(app.doc, id, DAILY, key);
  app.open(id, where);
}

export const shiftDay = (key: string, days: number) => {
  const date = dayOf(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};
