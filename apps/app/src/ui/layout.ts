import { useSyncExternalStore } from "react";
import { savedStore } from "@/platform/store";

/** A screen too small for sidebars beside the page: a phone, or a very narrow window. The CSS uses the same 700px. */
export const NARROW_QUERY = "(max-width: 700px)";
export const isNarrow = () => matchMedia(NARROW_QUERY).matches;

const onNarrowChange = (listener: () => void) => {
  const query = matchMedia(NARROW_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
/** isNarrow, redrawn when the window crosses the line. */
export const useNarrow = () => useSyncExternalStore(onNarrowChange, isNarrow);

/**
 * The main pointer is a finger, as on a phone or tablet: no hover, no right
 * click, and the phone's own long press. A touch screen laptop with a mouse is not.
 */
export const touchFirst = () => matchMedia("(pointer: coarse)").matches;

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
