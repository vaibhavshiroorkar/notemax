import type { Plugin } from "@/plugins/types";
import { SlashCommand } from "./slash-command";
import { BLOCK_ITEMS } from "./slash-items";

export const slashPlugin: Plugin = {
  id: "slash",
  name: "/ menu",
  options: [{ id: "hints", label: "Show the Markdown shortcut next to each block", default: true }],
  editorExtensions: () => [SlashCommand],
  slashItems: BLOCK_ITEMS,
};
