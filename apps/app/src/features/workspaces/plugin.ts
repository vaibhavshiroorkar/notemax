import type { Plugin } from "@/plugins/types";
import { HomeView } from "./HomeView";
import { Switcher } from "./Switcher";
import "./workspaces.css";

export const workspacesPlugin: Plugin = {
  id: "workspaces",
  name: "Workspaces",
  description: "Separate sets of pages, like Work and Personal, switched from the top left, with a Home page to arrange them",
  required: true,
  // Above everything else in the left sidebar.
  sidebarSections: [{ id: "workspaces.switch", order: -30, component: Switcher }],
  views: [{ id: "home", title: "Home", icon: "home", component: HomeView }],
  commands: [{ id: "workspaces.home", title: "Go Home: all workspaces", keywords: ["workspace", "switch", "home", "profile"], run: (app) => app.openView("home") }],
};
