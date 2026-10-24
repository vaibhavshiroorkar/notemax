import { useEffect, useMemo, useState } from "react";
import { dueOn, entries, useTaskVersion } from "@/features/tasks/list";
import { TaskRow } from "@/features/tasks/TaskRow";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { addPageOn, dailyNote, dateOf, dayKey, dayOf, openDay, pagesByDay, todayKey } from "./dates";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** The days shown for a month: whole weeks from Monday, with the month's days among them. */
function weeksOf(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/**
 * A month in the right sidebar. Days with pages are marked. A click picks a
 * day and lists its journal entry and pages below; a double click or Enter
 * opens the entry.
 */
export function CalendarPanel({ app }: { app: AppContext }) {
  const open = app.activeId ? app.tree.byId.get(app.activeId) : undefined;
  const openKey = open ? dateOf(open) : null;
  const [month, setMonth] = useState(() => {
    const d = openKey ? dayOf(openKey) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const byDay = useMemo(() => pagesByDay(app.tree), [app.tree]);
  // To-dos due each day, while the Tasks plugin is on.
  const taskVersion = useTaskVersion();
  const tasksOn = registry.isOn("tasks");
  const undone = useMemo(() => (tasksOn ? entries(app.tree).filter((entry) => !entry.task.done && entry.task.due) : []), [app.tree, taskVersion, tasksOn]);
  const dueDays = useMemo(() => new Set(undone.map((entry) => entry.task.due!)), [undone]);
  const [picked, setPicked] = useState<string>(openKey ?? todayKey());
  // Opening a dated page picks its day.
  useEffect(() => {
    if (openKey) setPicked(openKey);
  }, [openKey]);
  const today = todayKey();
  const days = weeksOf(month.year, month.month);
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const step = (by: number) => setMonth(({ year, month: m }) => ({ year: m + by < 0 ? year - 1 : m + by > 11 ? year + 1 : year, month: (m + by + 12) % 12 }));
  const entry = dailyNote(app.tree, picked);
  const pickedTasks = dueOn(undone, picked);
  const onPicked = (byDay.get(picked) ?? []).filter((item) => item.id !== entry?.id);
  const pickedName = dayOf(picked).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="calendar">
      <header className="calendar-head">
        <button className="icon-button" aria-label="Previous month" onClick={() => step(-1)}>
          <Icon name="chevron-right" />
        </button>
        <strong>{title}</strong>
        <button className="icon-button" aria-label="Next month" onClick={() => step(1)}>
          <Icon name="chevron-right" />
        </button>
      </header>
      <div className="calendar-grid" role="grid" aria-label={title}>
        {WEEKDAYS.map((day) => (
          <span key={day} className="calendar-weekday" role="columnheader">
            {day}
          </span>
        ))}
        {days.map((date) => {
          const key = dayKey(date);
          const pages = byDay.get(key);
          return (
            <button
              key={key}
              role="gridcell"
              className="calendar-day"
              data-out={date.getMonth() !== month.month || undefined}
              data-today={key === today || undefined}
              data-picked={key === picked || undefined}
              data-has={pages ? pages.length : undefined}
              data-tasks={dueDays.has(key) || undefined}
              aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "long" })}${pages ? `, ${pages.length} ${pages.length === 1 ? "page" : "pages"}` : ""}`}
              onClick={() => setPicked(key)}
              onDoubleClick={() => void openDay(app, key)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                setPicked(key);
                void openDay(app, key);
              }}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <section className="calendar-day-info" aria-label={pickedName}>
        <header className="calendar-day-head">
          <strong>{pickedName}</strong>
          {picked !== today && (
            <button className="link-button" onClick={() => setPicked(today)}>
              Today
            </button>
          )}
        </header>
        {entry ? (
          <button className="row-title icon-title calendar-entry" onClick={() => app.open(entry.id)} onContextMenu={pageMenu(app.tree.byId.get(entry.id))}>
            <Icon name="calendar" />
            <span>{entry.title || "Journal entry"}</span>
          </button>
        ) : (
          <button className="link-button calendar-write" onClick={() => void openDay(app, picked)}>
            Write in journal
          </button>
        )}
        {onPicked.length > 0 && (
          <ul className="calendar-pages" aria-label={`Pages on ${dayOf(picked).toLocaleDateString(undefined, { dateStyle: "medium" })}`}>
            {onPicked.map((item) => (
              <li key={item.id}>
                <button className="row-title icon-title" onClick={() => app.open(item.id)} onContextMenu={pageMenu(app.tree.byId.get(item.id))}>
                  <Icon name={item.kind === "note" ? "note" : registry.iconOf(item.kind)} />
                  <span>{item.title || "Untitled"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pickedTasks.length > 0 && (
          <ul className="task-list calendar-tasks" aria-label="Due this day">
            {pickedTasks.map((task) => (
              <TaskRow key={`${task.noteId}:${task.task.id ?? task.index}`} app={app} entry={task} />
            ))}
          </ul>
        )}
        <button className="link-button calendar-add" onClick={() => addPageOn(app, picked)}>
          + Add a page for this day
        </button>
      </section>
    </div>
  );
}
