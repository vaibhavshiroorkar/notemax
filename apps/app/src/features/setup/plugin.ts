import type { Plugin } from "@/plugins/types";
import { SetupCard } from "./SetupCard";
import { SetupSection } from "./SetupSection";
import "./setup.css";

export const setupPlugin: Plugin = {
  id: "setup",
  name: "Setup",
  description: "Offline or online on this device, and where a window starts",
  required: true,
  // Under the workspace switcher, above the pages.
  sidebarSections: [{ id: "setup.card", order: -25, component: SetupCard }],
  settings: [{ id: "setup", order: 5, title: "Setup", icon: "settings", keywords: ["offline", "online", "account", "start", "home", "first"], component: SetupSection }],
  commands: [{ id: "setup.open", title: "Setup: offline or online", keywords: ["offline", "online", "start"], run: (app) => app.openSettings("setup") }],
};
