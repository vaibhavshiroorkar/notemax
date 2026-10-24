import type { Plugin } from "@/plugins/types";
import { BrowserPane } from "./BrowserPane";

export const browserPlugin: Plugin = {
  id: "browser",
  name: "Browser pages",
  description: "A web page inside a page, with an address bar, to read beside your notes in a split",
  kinds: [{ kind: "browser", label: "New browser page", icon: "globe", other: true }],
  pageViews: [{ kind: "browser", component: BrowserPane }],
  commands: [{ id: "browser.new", title: "New browser page", keywords: ["web", "site", "internet", "url", "link", "iframe"], run: (app) => app.create("browser") }],
};
