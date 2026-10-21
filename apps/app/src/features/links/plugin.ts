import type { Plugin } from "@/plugins/types";
import { WikiLink } from "./wiki-link";

export const linksPlugin: Plugin = {
  id: "links",
  name: "Links between notes",
  editorExtensions: ({ hub, noteId }) => [WikiLink.configure({ hub, currentId: noteId })],
};
