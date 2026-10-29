import type { Plugin } from "@/plugins/types";
import { BasicsSection } from "./BasicRows";
import { BehaviorSection } from "./BehaviorSection";
import { PluginOptionsSection } from "./PluginOptionsSection";
import { StorageSection } from "./sections";

export const settingsPlugin: Plugin = {
  id: "settings",
  name: "Settings",
  description: "This window",
  required: true,
  settings: [
    { id: "basics", order: 0, group: "General", title: "Basics", icon: "settings", keywords: ["common", "main", "general"], component: BasicsSection },
    { id: "behavior", order: 7, group: "General", title: "How it works", icon: "command", keywords: ["behavior", "behaviour", "tab", "link", "open", "new", "welcome", "customize"], component: BehaviorSection },
    { id: "plugins", order: 80, group: "Advanced", title: "Plugins", icon: "plug", component: PluginOptionsSection },
    { id: "storage", order: 65, group: "Your data", title: "Storage", icon: "storage", keywords: ["database", "disk", "data"], component: StorageSection },
  ],
  commands: [
    { id: "settings.open", title: "Open settings", keywords: ["preferences", "options"], shortcut: "Mod+,", run: (app) => app.openSettings() },
    { id: "settings.quick", title: "Quick settings", keywords: ["theme", "toggle", "switch"], shortcut: "Mod+.", run: (app) => app.toggleQuickSettings() },
  ],
};
