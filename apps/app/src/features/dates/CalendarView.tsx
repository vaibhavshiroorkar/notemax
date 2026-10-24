import { useMemo, useState } from "react";
import type { TreeItem } from "@notemax/core";
import { dueOn, entries, useTaskVersion, type Entry } from "@/features/tasks/list";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { dailyNote, dayKey, dayOf, openDay, pagesByDay, todayKey } from "./dates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** A day's square shows this many things, then "and n more". */
const SHOWN = 3;

/** Whole weeks from Monday that hold a month. */
function weeksOf(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  const days = Math.ceil((((first.getDay() + 6) % 7) + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** What a day holds: its journal entry, pages dated that day, and to-dos due. */
function useDays(app: AppContext) {
  const version = useTaskVersion();
  const byDay = useMemo(() => pagesByDay(app.tree), [app.tree]);
  const tasks = useMemo(() => (registry.isOn("tasks") ? entries(app.tree).filter((e) => !e.task.done && e.task.due) : []), [app.tree, version]);
  return (key: string): { entry: TreeItem | undefined; pages: TreeItem[]; tasks: Entry[] } => {
    const entry = dailyNote(app.tree, key);
    return { entry, pages: (byDay.get(key) ?? []).filter((item) => item.id !== entry?.id), tasks: dueOn(tasks, key) };
  };
}

/** The calendar as a page of its own: a month, each day with what it holds, a click away. */
export function CalendarView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const [month, setMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const today = todayKey();
  const dayOfWork = useDays(app);
  const days = weeksOf(month.year, month.month);
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const step = (by: number) => setMonth(({ year, month: m }) => ({ year: m + by < 0 ? year - 1 : m + by > 11 ? year + 1 : year, month: (m + by + 12) % 12 }));

  return (
    <article className="note calendar-view">
      <header className="calendar-view-head">
        <h1>{title}</h1>
        <div className="calendar-view-nav">
          <button className="icon-button calendar-back" aria-label="Previous month" onClick={() => step(-1)}>
            <Icon name="chevron-left" />
          </button>
          <button className="button" onClick={() => setMonth({ year: new Date().getFullYear(), month: new Date().getMonth() })}>
            Today
          </button>
          <button className="icon-button" aria-label="Next month" onClick={() => step(1)}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </header>
      <div className="calendar-month" role="grid" aria-label={title}>
        {WEEKDAYS.map((day) => (
          <span key={day} className="calendar-month-weekday" role="columnheader">
            {day}
          </span>
        ))}
        {days.map((date) => {
          const key = dayKey(date);
          const { entry, pages, tasks } = dayOfWork(key);
          const things = [
            ...(entry ? [{ id: entry.id, label: entry.title || "Journal entry", kind: "entry", open: () => app.open(entry.id) }] : []),
            ...pages.map((item) => ({ id: item.id, label: item.title || "Untitled", kind: "page", open: () => app.open(item.id) })),
            ...tasks.map((t) => ({ id: `${t.noteId}:${t.task.id ?? t.index}`, label: t.task.text, kind: "task", open: () => app.open(t.noteId) })),
          ];
          return (
            <div key={key} role="gridcell" className="calendar-month-day" data-out={date.getMonth() !== month.month || undefined} data-today={key === today || undefined} aria-label={dayOf(key).toLocaleDateString(undefined, { dateStyle: "full" })}>
              <button className="calendar-month-date" title={entry ? "Open this day's entry" : "Write in the journal for this day"} onClick={() => void openDay(app, key)}>
                {date.getDate()}
              </button>
              <ul>
                {things.slice(0, SHOWN).map((thing) => (
                  <li key={thing.id}>
                    <button className="calendar-month-thing" data-kind={thing.kind} onClick={thing.open}>
                      {thing.label}
                    </button>
                  </li>
                ))}
                {things.length > SHOWN && <li className="calendar-month-more">and {things.length - SHOWN} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/** Home's Calendar card: this week, each day with how much it holds. A click opens the full calendar. */
export function WeekHome({ app }: { app: AppContext }) {
  const today = todayKey();
  const dayOfWork = useDays(app);
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  return (
    <ol className="week-strip">
      {week.map((date, i) => {
        const key = dayKey(date);
        const { entry, pages, tasks } = dayOfWork(key);
        const count = (entry ? 1 : 0) + pages.length + tasks.length;
        return (
          <li key={key} data-today={key === today || undefined}>
            <button onClick={() => (key === today ? void openDay(app, key) : app.openView("calendar"))} aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "full" })}, ${count} ${count === 1 ? "thing" : "things"}`}>
              <span className="week-strip-day">{WEEKDAYS[i]}</span>
              <span className="week-strip-date">{date.getDate()}</span>
              <span className="week-strip-count">{count ? count : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
