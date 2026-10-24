import { useMemo } from "react";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { entries, grouped, useTaskVersion } from "./list";
import { TaskRow } from "./TaskRow";

const SHOWN = 8;

/** Home's Today card: what is overdue and what is due today, with a way to the full list. */
export function TodayHome({ app }: { app: AppContext }) {
  const version = useTaskVersion();
  const groups = useMemo(() => grouped(entries(app.tree)), [app.tree, version]);
  const due = [...groups.overdue, ...groups.today];
  return (
    <>
      {due.length ? (
        <ul className="task-list">
          {due.slice(0, SHOWN).map((entry) => (
            <TaskRow key={`${entry.noteId}:${entry.task.id ?? entry.index}`} app={app} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="home-empty">Nothing due today.</p>
      )}
      <button className="button home-card-action" onClick={() => app.openView("tasks")}>
        <Icon name="list-check" />
        {due.length > SHOWN ? `All tasks (${due.length - SHOWN} more today)` : "All tasks"}
      </button>
    </>
  );
}
