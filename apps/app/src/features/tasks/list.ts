import { finishTask, type Task, type Tree } from "@notemax/core";
import { acquireDoc, releaseDoc } from "@/data/docCache";
import { todayKey } from "@/features/dates/dates";
import { allTasks, indexVersion, readAgain } from "@/features/search/text-index";
import type { AppContext } from "@/plugins/types";

/** A to-do and the note it is in. `index` is its place in the note, for one with no id yet. */
export interface Entry {
  noteId: string;
  index: number;
  task: Task;
}

const byWhen = (a: Entry, b: Entry) =>
  (a.task.due ?? "9999") < (b.task.due ?? "9999") ? -1 : (a.task.due ?? "9999") > (b.task.due ?? "9999") ? 1 : (a.task.time ?? "99") < (b.task.time ?? "99") ? -1 : (a.task.time ?? "99") > (b.task.time ?? "99") ? 1 : b.task.priority - a.task.priority;

/** Every to-do in the notes on show, trashed notes left out. */
export function entries(tree: Tree): Entry[] {
  const out: Entry[] = [];
  for (const [noteId, tasks] of allTasks()) {
    if (!tree.visible.has(noteId)) continue;
    tasks.forEach((task, index) => task.text && out.push({ noteId, index, task }));
  }
  return out;
}

export interface Groups {
  overdue: Entry[];
  today: Entry[];
  upcoming: Entry[];
  undated: Entry[];
  done: Entry[];
}

/** Today's to-dos stay under Today even once their time has passed; their chip turns red instead. */
export function grouped(list: Entry[]): Groups {
  const today = todayKey();
  const groups: Groups = { overdue: [], today: [], upcoming: [], undated: [], done: [] };
  for (const entry of list) {
    const { task } = entry;
    if (task.done) groups.done.push(entry);
    else if (!task.due) groups.undated.push(entry);
    else if (task.due < today) groups.overdue.push(entry);
    else if (task.due === today) groups.today.push(entry);
    else groups.upcoming.push(entry);
  }
  for (const list of Object.values(groups)) list.sort(byWhen);
  groups.undated.sort((a, b) => b.task.priority - a.task.priority);
  return groups;
}

/** Due on a day and not done, for the calendar. */
export const dueOn = (list: Entry[], key: string) => list.filter((entry) => entry.task.due === key).sort(byWhen);

/** Calls for a fresh list whenever the index changes. */
export const useTaskVersion = () => indexVersion.use();

/**
 * Ticks or unticks a to-do in its note, which may not be open. An open page
 * shows it at once, through the doc channel. A repeating one moves to its
 * next day instead.
 */
export async function setDone(app: AppContext, entry: Entry, done: boolean) {
  const doc = await acquireDoc(entry.noteId, app.workspace);
  try {
    const found = finishTask(doc.doc.getXmlFragment("content"), entry.task.id ?? entry.index, done);
    if (!found) app.notify("That to-do has changed since. Open its note to tick it.");
    await doc.flush();
  } finally {
    releaseDoc(entry.noteId, app.workspace);
  }
  readAgain(entry.noteId);
}
