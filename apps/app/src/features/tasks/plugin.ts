import { startIndex } from "@/features/search/text-index";
import { registry } from "@/plugins/registry";
import type { Plugin } from "@/plugins/types";
import { TaskAttrs, TaskDates } from "./editor";
import { startReminders } from "./reminders";
import { RemindersHost } from "./RemindersHost";
import { RemindersSection } from "./RemindersSection";
import { TasksView } from "./TasksView";
import { TodayHome } from "./TodayHome";
import "./tasks.css";

export const tasksPlugin: Plugin = {
  id: "tasks",
  name: "Tasks",
  description: "Dates, repeats, priorities and reminders on to-dos, a Tasks page that lists them all, and Today on Home",
  // The attributes are known to every note, so turning Tasks off loses no dates.
  contentExtensions: () => [TaskAttrs],
  editorExtensions: () => [TaskDates],
  views: [{ id: "tasks", title: "Tasks", icon: "list-check", component: TasksView }],
  homeSections: [{ id: "tasks.today", title: "Today", order: 15, open: (app) => app.openView("tasks"), component: TodayHome }],
  floating: [{ id: "tasks.reminders", component: RemindersHost }],
  settings: [{ id: "reminders", order: 35, group: "Writing", title: "Reminders", icon: "clock", keywords: ["notifications", "alarm", "tasks", "to-do"], component: RemindersSection }],
  commands: [{ id: "tasks.open", title: "Open tasks", keywords: ["todo", "to-do", "due", "today", "upcoming", "overdue"], shortcut: "Mod+Alt+T", run: (app) => app.openView("tasks") }],
  // The list comes from the search index, which the Search plugin starts; without it, Tasks starts it.
  workspaceStart: (app) => {
    if (!registry.isOn("search")) void startIndex(app.doc, app.workspace).catch((err) => console.warn("[notemax] could not read the to-dos", err));
    startReminders(app);
  },
};
