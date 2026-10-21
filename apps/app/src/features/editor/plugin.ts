import { TaskItem, TaskList } from "@tiptap/extension-list";
import type { Plugin } from "@/plugins/types";
import { NotePane } from "./NotePane";

export const notesPlugin: Plugin = {
  id: "notes",
  name: "Notes",
  editorExtensions: () => [TaskList, TaskItem.configure({ nested: true })],
  kinds: [{ kind: "note", label: "New note", icon: "note" }],
  pageViews: [{ kind: "note", component: NotePane }],
  commands: [{ id: "notes.new", title: "New note", keywords: ["create", "add"], run: (app) => app.create("note") }],
};
