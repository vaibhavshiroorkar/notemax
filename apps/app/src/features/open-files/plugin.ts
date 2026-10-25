import type { ContextMenuItem, ContextTarget, Plugin } from "@/plugins/types";
import { GROUPS, pickFiles } from "./open";

const nearOf = (target: ContextTarget) => (target.type === "page" ? target.node : null);

/**
 * Open, on a page's row and on empty space: files from the computer, by kind.
 * The sidebar's menu lists these first, so Open comes before Open in.
 */
export const OPEN_FILE_ITEMS: ContextMenuItem[] = GROUPS.map(({ id, title }) => ({
  id: `open-files.${id}`,
  inside: "open" as const,
  title,
  group: "open",
  targets: ["page", "sidebar"],
  run: (target, app) => pickFiles(app, id, nearOf(target)),
}));

export const openFilesPlugin: Plugin = {
  id: "open-files",
  name: "Open files",
  description: "Open Markdown, text, Word, web page, code, picture and Excalidraw files from the computer as pages",
  commands: [{ id: "open-files.notes", title: "Open files from this computer", keywords: ["import", "markdown", "word", "docx", "text", "file"], run: (app) => pickFiles(app, "notes", null) }],
};
