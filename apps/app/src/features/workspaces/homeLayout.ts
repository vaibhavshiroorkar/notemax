import { savedStore } from "@/platform/store";

/**
 * How Home is arranged: the cards in the order chosen, those turned off, and
 * one column or two. Cards the layout has never seen, like a new plugin's,
 * go where their own order puts them. It follows you to your other devices.
 */
export interface HomeLayout {
  order: string[];
  off: string[];
  columns: 1 | 2;
}

const DEFAULT: HomeLayout = { order: [], off: [], columns: 2 };

export const homeLayout = savedStore<HomeLayout>("homeLayout", DEFAULT, {
  decode(raw) {
    const value = JSON.parse(raw) as Partial<HomeLayout>;
    const strings = (list: unknown) => (Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : []);
    return { order: strings(value.order), off: strings(value.off), columns: value.columns === 1 ? 1 : 2 };
  },
  encode: (value) => JSON.stringify(value),
});

/** The ids in the order Home shows them: the chosen order first, the rest by their own order. */
export function arranged<T extends { id: string; order: number }>(sections: T[], layout: HomeLayout): T[] {
  const rank = (section: T) => {
    const at = layout.order.indexOf(section.id);
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };
  return [...sections].sort((a, b) => rank(a) - rank(b) || a.order - b.order);
}

/** Moves a card one place up or down, writing the whole order so it stays put. */
export function moveCard(ids: string[], id: string, by: -1 | 1): string[] {
  const at = ids.indexOf(id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}
