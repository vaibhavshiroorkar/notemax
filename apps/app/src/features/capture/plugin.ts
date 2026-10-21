import { isDesktop } from "@/platform/platform";
import type { Plugin } from "@/plugins/types";
import { CaptureSection } from "./CaptureSection";

export const capturePlugin: Plugin = {
  id: "capture",
  name: "Quick capture",
  settings: [{ id: "capture", order: 30, when: () => isDesktop, component: CaptureSection }],
};
