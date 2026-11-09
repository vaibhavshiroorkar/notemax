import type { Plugin } from "@/plugins/types";
import { CalendarPanel } from "./CalendarPanel";
import { CalendarView, WeekHome } from "./CalendarView";
import { DateSetting } from "./DateSetting";
import { openDay, shiftDay, startJournal, todayKey } from "./dates";
import { makeJournal } from "./journal";
import "./dates.css";

export const datesPlugin: Plugin = {
  id: "dates",
  name: "Daily notes and calendar",
  description: "Journals, a note for each day, a calendar in the right sidebar, and a date on any page",
  // A note set up as a journal: its days on its page, newest first.
  kinds: [{ id: "journal", kind: "note", label: "New journal", icon: "calendar", other: true, setup: makeJournal }],
  sidePanels: [{ id: "dates.calendar", title: "Calendar", order: 80, component: CalendarPanel }],
  homeSections: [
    { id: "dates.week", title: "This week", order: 17, open: (app) => app.openView("calendar"), component: WeekHome },
  ],
  views: [{ id: "calendar", title: "Calendar", icon: "calendar", component: CalendarView }],
  pageSettings: [{ id: "dates.date", component: DateSetting }],
  workspaceStart: (app) => void startJournal(app).catch((err) => console.warn("[notemax] could not start the journal", err)),
  commands: [
    { id: "dates.journal", title: "New journal", keywords: ["diary", "daily", "log", "days"], run: (app) => app.create("note", makeJournal) },
    { id: "dates.calendar", title: "Open the calendar", keywords: ["month", "dates", "schedule", "agenda"], run: (app) => app.openView("calendar") },
    { id: "dates.today", title: "Open today's note", keywords: ["daily", "journal", "diary", "today"], shortcut: "Mod+Alt+D", run: (app) => void openDay(app, todayKey()) },
    { id: "dates.yesterday", title: "Open yesterday's note", keywords: ["daily", "journal", "diary"], run: (app) => void openDay(app, shiftDay(todayKey(), -1)) },
    { id: "dates.tomorrow", title: "Open tomorrow's note", keywords: ["daily", "journal", "plan"], run: (app) => void openDay(app, shiftDay(todayKey(), 1)) },
  ],
};
