import { savedStore } from "@/platform/store";

export interface GraphChoices {
  /** Steps out from the open page in a local graph. */
  depth: number;
  containers: boolean;
  hideLonely: boolean;
  tags: boolean;
}

const DEFAULTS: GraphChoices = { depth: 2, containers: false, hideLonely: false, tags: false };

const decode = (raw: string): GraphChoices => {
  const value = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<GraphChoices>) };
  value.depth = [1, 2, 3].includes(value.depth) ? value.depth : DEFAULTS.depth;
  return value;
};

/** What the full graph shows, kept between openings. */
export const graphChoices = savedStore<GraphChoices>("graphChoices", DEFAULTS, { decode });

/** The same for the small graph in the right sidebar, which starts closer in. */
export const panelChoices = savedStore<GraphChoices>("graphPanelChoices", { ...DEFAULTS, depth: 1 }, { decode });
