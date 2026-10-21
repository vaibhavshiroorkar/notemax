import type { Plugin } from "@/plugins/types";
import { PluginOptionsSection } from "./PluginOptionsSection";
import { StorageSection } from "./sections";

export const settingsPlugin: Plugin = {
  id: "settings",
  name: "Settings",
  settings: [
    { id: "plugin-options", order: 80, component: PluginOptionsSection },
    { id: "storage", order: 90, component: StorageSection },
  ],
  commands: [
    { id: "settings.open", title: "Open settings", keywords: ["preferences", "options"], shortcut: "Mod+,", run: (app) => app.openSettings() },
  ],
};
