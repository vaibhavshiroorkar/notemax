import { useMemo, useState } from "react";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { entries, grouped, useTaskVersion, type Entry } from "./list";
import { TaskRow } from "./TaskRow";

const DONE_SHOWN = 30;

function Group({ app, title, list, tone }: { app: AppContext; title: string; list: Entry[]; tone?: string }) {
  if (!list.length) return null;
  return (
    <section className="task-group" data-tone={tone} aria-label={title}>
      <h2>
        {title} <span className="task-count">{list.length}</span>
      </h2>
      <ul className="task-list">
        {list.map((entry) => (
          <TaskRow key={`${entry.noteId}:${entry.task.id ?? entry.index}`} app={app} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

/** Every to-do in the workspace, by when it is due. They stay in their notes; this only lists them. */
export function TasksView({ app }: { app: AppContext }) {
  const version = useTaskVersion();
  const groups = useMemo(() => grouped(entries(app.tree)), [app.tree, version]);
  const [showDone, setShowDone] = useState(false);
  const open = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.undated.length;
  return (
    <article className="note tasks-view">
      <h1 className="tasks-title">
        <Icon name="list-check" /> Tasks
      </h1>
      {!open && !groups.done.length ? (
        <p className="tasks-empty">No to-dos yet. Make a to-do list in any note (type [ ] and a space), and write a day after it, like "call mum tomorrow 5pm". Each one shows up here.</p>
      ) : !open ? (
        <p className="tasks-empty">Everything is done.</p>
      ) : null}
      <Group app={app} title="Overdue" list={groups.overdue} tone="overdue" />
      <Group app={app} title="Today" list={groups.today} />
      <Group app={app} title="Upcoming" list={groups.upcoming} />
      <Group app={app} title="No date" list={groups.undated} />
      {groups.done.length > 0 && (
        <section className="task-group" aria-label="Done">
          <button className="link-button task-done-toggle" aria-expanded={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide" : "Show"} done ({groups.done.length})
          </button>
          {showDone && (
            <ul className="task-list">
              {groups.done.slice(0, DONE_SHOWN).map((entry) => (
                <TaskRow key={`${entry.noteId}:${entry.task.id ?? entry.index}`} app={app} entry={entry} />
              ))}
            </ul>
          )}
        </section>
      )}
    </article>
  );
}
