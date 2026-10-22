import type { Plugin } from "@/plugins/types";
import { SlashCommand } from "./slash-command";
import { BLOCK_ITEMS } from "./slash-items";

export const slashPlugin: Plugin = {
  id: "slash",
  name: "/ menu",
  description: "Type / in a note for headings, lists, to-dos and more",
  options: [{ id: "hints", label: "Show the Markdown shortcut next to each block", description: "In the / menu", section: "editor", default: true }],
  shortcutHints: [{ title: "Pick a block: heading, list, to-do and more", keys: "/" }],
  editorExtensions: () => [SlashCommand],
  slashItems: BLOCK_ITEMS,
};
