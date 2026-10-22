import { useMemo, useState } from "react";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { dateOf, dayKey, dayOf, openDay, pagesByDay, todayKey } from "./dates";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** The days shown for a month: whole weeks from Monday, with the month's days among them. */
function weeksOf(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** A month in the right sidebar. Days with notes are marked; a click opens that day's note. */
export function CalendarPanel({ app }: { app: AppContext }) {
  const open = app.activeId ? app.tree.byId.get(app.activeId) : undefined;
  const openKey = open ? dateOf(open) : null;
  const [month, setMonth] = useState(() => {
    const d = openKey ? dayOf(openKey) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const byDay = useMemo(() => pagesByDay(app.tree), [app.tree]);
  const [picked, setPicked] = useState<string>(openKey ?? todayKey());
  const today = todayKey();
  const days = weeksOf(month.year, month.month);
  const title = new Date(month.year, month.month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const step = (by: number) => setMonth(({ year, month: m }) => ({ year: m + by < 0 ? year - 1 : m + by > 11 ? year + 1 : year, month: (m + by + 12) % 12 }));
  const onPicked = byDay.get(picked) ?? [];

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
              aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "long" })}${pages ? `, ${pages.length} ${pages.length === 1 ? "page" : "pages"}` : ""}`}
              onClick={() => {
                setPicked(key);
                void openDay(app, key);
              }}
              onMouseEnter={() => pages && setPicked(key)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="calendar-actions">
        <button className="link-button" onClick={() => void openDay(app, today)}>
          Today
        </button>
      </div>
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
    </div>
  );
}
