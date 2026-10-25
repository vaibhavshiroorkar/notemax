import type { Plugin } from "@/plugins/types";
import { BrowserPane } from "./BrowserPane";
import { isDesktop } from "@/platform/platform";

export const browserPlugin: Plugin = {
  id: "browser",
  name: "Browser pages",
  description: "Browse sites beside your notes in the desktop app",
  kinds: isDesktop ? [{ kind: "browser", label: "New browser page", icon: "globe", other: true }] : [],
  pageViews: [{ kind: "browser", component: BrowserPane }],
  commands: isDesktop ? [{ id: "browser.new", title: "New browser page", keywords: ["web", "site", "internet", "url", "link"], run: (app) => app.create("browser") }] : [],
};
