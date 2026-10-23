import { savedStore } from "@/platform/store";

/**
 * Where the right sidebar's sections sit. Slots are boxes stacked from top to
 * bottom. A box with one section shows its title; with two or more it shows
 * tabs, and `active` is the tab in front. Sections in `off` wait in the tray
 * at the bottom. A section the layout has never seen, like one a new plugin
 * adds, gets a box of its own at the end.
 */
export interface Slot {
  panels: string[];
  active?: string;
}

export interface PanelLayout {
  slots: Slot[];
  off: string[];
}

/**
 * Off at first, so the sidebar starts empty but for a book's chapters, which a
 * book needs to move between them. The rest are one click away in the tray.
 */
const OFF_AT_FIRST = ["format.panel", "history.versions", "search.mentions", "graph.panel", "page-info.panel", "page-info.inside", "links.backlinks", "dates.calendar"];

const EMPTY: PanelLayout = { slots: [], off: OFF_AT_FIRST };

const isSlot = (value: unknown): value is Slot =>
  !!value && Array.isArray((value as Slot).panels) && (value as Slot).panels.every((id) => typeof id === "string");

export const panelLayout = savedStore<PanelLayout>("panelLayout", EMPTY, {
  decode: (raw) => {
    try {
      const value = JSON.parse(raw) as PanelLayout;
      if (!Array.isArray(value.slots) || !value.slots.every(isSlot) || !Array.isArray(value.off)) return EMPTY;
      return value;
    } catch {
      return EMPTY;
    }
  },
  encode: (value) => JSON.stringify(value),
});

/** The layout with every known section placed: new ones get their own slot at the end. */
export function placed(layout: PanelLayout, known: string[]): PanelLayout {
  const seen = new Set(layout.slots.flatMap((slot) => slot.panels));
  const fresh = known.filter((id) => !seen.has(id));
  if (!fresh.length) return layout;
  return { ...layout, slots: [...layout.slots, ...fresh.map((id) => ({ panels: [id] }))] };
}

// Takes a section out of every slot. Emptied slots stay until tidy(), so indexes still point where they did.
const lifted = (layout: PanelLayout, id: string): Slot[] =>
  layout.slots.map((slot) => {
    const panels = slot.panels.filter((p) => p !== id);
    return { panels, active: slot.active === id ? panels[0] : slot.active };
  });

const tidy = (slots: Slot[]) => slots.filter((slot) => slot.panels.length > 0);

/** Moves a section into slot `index` as a tab, in front. */
export function joinSlot(layout: PanelLayout, id: string, index: number): PanelLayout {
  if (!layout.slots[index] || layout.slots[index].panels.includes(id)) return layout;
  const slots = lifted(layout, id);
  slots[index] = { panels: [...slots[index].panels, id], active: id };
  return { ...layout, slots: tidy(slots) };
}

/** Moves a section into a slot of its own before slot `index`, or at the end when past the last. */
export function newSlot(layout: PanelLayout, id: string, index: number): PanelLayout {
  const slots = lifted(layout, id);
  slots.splice(Math.min(index, slots.length), 0, { panels: [id] });
  return { ...layout, slots: tidy(slots) };
}

export const setActive = (layout: PanelLayout, index: number, id: string): PanelLayout => ({
  ...layout,
  slots: layout.slots.map((slot, i) => (i === index ? { ...slot, active: id } : slot)),
});

export const setOn = (layout: PanelLayout, id: string, on: boolean): PanelLayout => ({
  ...layout,
  off: on ? layout.off.filter((p) => p !== id) : [...new Set([...layout.off, id])],
});
