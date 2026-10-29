import type { Plugin } from "@/plugins/types";
import { FindHighlight } from "./find";
import { FindBar, finding, noteToSearch } from "./FindBar";
import "./find.css";

// Only while a note is on screen. Elsewhere the keys stay the browser's, so
// its own find still works on the web.
const hasNote = () => noteToSearch() !== null;

export const findPlugin: Plugin = {
  id: "find",
  name: "Find and replace",
  description: "Ctrl+F finds words in the open note, Ctrl+H replaces them",
  editorExtensions: () => [FindHighlight],
  floating: [{ id: "find.bar", component: FindBar }],
  commands: [
    { id: "find.open", title: "Find in this note", keywords: ["search", "find", "look"], shortcut: "Mod+F", when: hasNote, run: () => finding.set({ replace: false }) },
    { id: "find.replace", title: "Find and replace", keywords: ["replace", "change", "swap"], shortcut: "Mod+H", when: hasNote, run: () => finding.set({ replace: true }) },
  ],
};
