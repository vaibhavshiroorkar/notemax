import { useState } from "react";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { setDone, type Entry } from "./list";
import { isOverdue, whenLabel } from "./when";

/** One to-do in a list away from its note: a box to tick, its text, its date and the note it is in. */
export function TaskRow({ app, entry, showNote = true }: { app: AppContext; entry: Entry; showNote?: boolean }) {
  const { task, noteId } = entry;
  // Ticked at once here; the note catches up a moment later.
  const [ticked, setTicked] = useState<boolean | null>(null);
  const done = ticked ?? task.done;
  const label = whenLabel(task);
  const note = app.tree.byId.get(noteId);
  return (
    <li className="task-row" data-done={done || undefined}>
      <input
        type="checkbox"
        checked={done}
        aria-label={`${done ? "Untick" : "Tick"} ${task.text}`}
        onChange={(event) => {
          setTicked(event.target.checked);
          void setDone(app, entry, event.target.checked).finally(() => setTicked(null));
        }}
      />
      <span className="task-text">{task.text}</span>
      {task.priority > 0 && (
        <span className="task-priority" data-level={task.priority} aria-label={`Priority ${task.priority}`}>
          {"!".repeat(task.priority)}
        </span>
      )}
      {label && (
        <span className="task-when" data-overdue={!done && isOverdue(task) ? "" : undefined}>
          {label}
        </span>
      )}
      {showNote && note && (
        <button className="link-button task-note" onClick={() => app.open(noteId)} onContextMenu={pageMenu(note)}>
          {note.title || "Untitled"}
        </button>
      )}
    </li>
  );
}
