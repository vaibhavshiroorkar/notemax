import { isDesktop } from "@/platform/platform";
import type { Plugin } from "@/plugins/types";
import { CaptureSection } from "./CaptureSection";

export const capturePlugin: Plugin = {
  id: "capture",
  name: "Quick capture",
  description: "A small window from anywhere with Ctrl+Alt+N (desktop app)",
  // The hotkey lives in the desktop app itself, so switching this off here would not stop it.
  required: true,
  settings: [{ id: "capture", order: 50, title: "Quick capture", icon: "bolt", keywords: ["hotkey", "inbox"], when: () => isDesktop, component: CaptureSection }],
};
