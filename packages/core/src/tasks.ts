import * as Y from "yjs";
import { plainText } from "./words";
import { nextDue, type Repeat } from "./when";

// To-do items inside notes, read for the Tasks view and reminders. The editor
// keeps a task's date on the item itself, as attributes beside "checked".

export interface Task {
  /** Given by the editor to every task, so a list elsewhere can tick the right one. Null on tasks not yet seen by it. */
  id: string | null;
  text: string;
  done: boolean;
  due: string | null;
  time: string | null;
  repeat: Repeat | null;
  priority: number;
  /** Minutes before the time to ring, or null for no reminder. */
  remind: number | null;
}

const REPEATS: readonly string[] = ["day", "week", "month", "year"];
const str = (value: unknown) => (typeof value === "string" && value ? value : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null);

function taskOf(item: Y.XmlElement): Task {
  // The item's own line: its paragraphs, not the tasks inside it.
  const text = item
    .toArray()
    .filter((child): child is Y.XmlElement => child instanceof Y.XmlElement && child.nodeName === "paragraph")
    .map((paragraph) => plainText(paragraph as unknown as Y.XmlFragment))
    .join(" ")
    .trim();
  const repeat = str(item.getAttribute("repeat"));
  const checked = item.getAttribute("checked") as unknown;
  return {
    id: str(item.getAttribute("id")),
    text,
    done: checked === true || checked === "true",
    due: str(item.getAttribute("due")),
    time: str(item.getAttribute("time")),
    repeat: repeat && REPEATS.includes(repeat) ? (repeat as Repeat) : null,
    priority: num(item.getAttribute("priority")) ?? 0,
    remind: num(item.getAttribute("remind")),
  };
}

function items(parent: Y.XmlFragment | Y.XmlElement, out: Y.XmlElement[] = []): Y.XmlElement[] {
  for (const child of parent.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue;
    if (child.nodeName === "taskItem") out.push(child);
    items(child, out);
  }
  return out;
}

/** Every task in a note's body, top to bottom. */
export const tasksIn = (body: Y.XmlFragment): Task[] => items(body).map(taskOf);

/**
 * Ticks a task or unticks it, found by its id, or by its place in the note
 * for a task the editor has not given an id yet. A repeating task is not
 * ticked: it moves to its next day, ready again. Returns false when there is
 * no such task.
 */
export function finishTask(body: Y.XmlFragment, which: string | number, done: boolean): boolean {
  const all = items(body);
  const item = typeof which === "number" ? all[which] : all.find((el) => el.getAttribute("id") === which);
  if (!item) return false;
  const task = taskOf(item);
  const apply = () => {
    if (done && task.repeat && task.due) item.setAttribute("due", nextDue(task.due, task.repeat));
    else item.setAttribute("checked", done as unknown as string);
  };
  if (body.doc) body.doc.transact(apply);
  else apply();
  return true;
}

/** A day with no time rings at this hour, when it rings at all. */
const MORNING = "09:00";

/**
 * When a to-do's reminder rings, in milliseconds, or null for none. A to-do
 * with a time rings at it unless told otherwise; one with only a day rings
 * at 9 in the morning, only when asked. `remind` is the minutes before, and
 * below zero turns it off.
 */
export function remindAt(task: Task): number | null {
  if (task.done || !task.due) return null;
  if (task.remind !== null && task.remind < 0) return null;
  if (!task.time && task.remind === null) return null;
  const [y, m, d] = task.due.split("-").map(Number);
  const [h, min] = (task.time ?? MORNING).split(":").map(Number);
  return new Date(y, m - 1, d, h, min).getTime() - (task.remind ?? 0) * 60_000;
}
