import type { Plugin } from "@/plugins/types";
import { ShortcutsSection } from "./ShortcutsSection";

export const shortcutsPlugin: Plugin = {
  id: "shortcuts",
  name: "Keyboard shortcuts",
  settings: [{ id: "shortcuts", order: 85, component: ShortcutsSection }],
};
