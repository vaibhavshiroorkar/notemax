import type { Plugin } from "@/plugins/types";
import { SetupDialog } from "./SetupDialog";
import { SetupSection } from "./SetupSection";
import "./setup.css";

export const setupPlugin: Plugin = {
  id: "setup",
  name: "Setup",
  description: "Offline or online on this device, and where a window starts",
  required: true,
  // Asked once, over everything, on a first visit.
  floating: [{ id: "setup.dialog", component: SetupDialog }],
  settings: [{ id: "setup", order: 5, group: "General", title: "Setup", icon: "settings", keywords: ["offline", "online", "account", "start", "home", "first"], component: SetupSection }],
  commands: [{ id: "setup.open", title: "Setup: offline or online", keywords: ["offline", "online", "start"], run: (app) => app.openSettings("setup") }],
};
