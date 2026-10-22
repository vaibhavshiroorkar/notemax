import type { Plugin } from "@/plugins/types";
import { CalendarPanel } from "./CalendarPanel";
import { DateSetting } from "./DateSetting";
import { openDay, shiftDay, todayKey } from "./dates";
import "./dates.css";

export const datesPlugin: Plugin = {
  id: "dates",
  name: "Daily notes and calendar",
  description: "A note for each day, a calendar in the right sidebar, and a date on any page",
  sidePanels: [{ id: "dates.calendar", title: "Calendar", order: 80, component: CalendarPanel }],
  pageSettings: [{ id: "dates.date", component: DateSetting }],
  commands: [
    { id: "dates.today", title: "Open today's note", keywords: ["daily", "journal", "diary", "today"], shortcut: "Mod+Alt+D", run: (app) => void openDay(app, todayKey()) },
    { id: "dates.yesterday", title: "Open yesterday's note", keywords: ["daily", "journal", "diary"], run: (app) => void openDay(app, shiftDay(todayKey(), -1)) },
    { id: "dates.tomorrow", title: "Open tomorrow's note", keywords: ["daily", "journal", "plan"], run: (app) => void openDay(app, shiftDay(todayKey(), 1)) },
  ],
};
