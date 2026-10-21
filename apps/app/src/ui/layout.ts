import { savedStore } from "@/platform/store";

export interface PaneSize {
  default: number;
  min: number;
  max: number;
}

export const SIDEBAR: PaneSize = { default: 260, min: 180, max: 520 };
export const SIDE_PANEL: PaneSize = { default: 240, min: 180, max: 480 };

const width = (key: string, size: PaneSize) =>
  savedStore(key, size.default, {
    decode(raw) {
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`bad width ${raw}`);
      return Math.min(size.max, Math.max(size.min, Math.round(value)));
    },
    encode: String,
  });

export const sidebarWidth = width("sidebarWidth", SIDEBAR);
export const sidePanelWidth = width("sidePanelWidth", SIDE_PANEL);
