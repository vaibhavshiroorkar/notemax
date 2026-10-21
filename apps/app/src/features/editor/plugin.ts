import { TaskItem, TaskList } from "@tiptap/extension-list";
import type { AppContext, Plugin } from "@/plugins/types";
import { duplicate } from "./duplicate";
import { NotePane } from "./NotePane";

const openNote = (app: AppContext) => (app.activeId && app.tree.byId.get(app.activeId)?.kind === "note" ? app.activeId : null);

export const notesPlugin: Plugin = {
  id: "notes",
  name: "Notes",
  options: [{ id: "spellcheck", label: "Check spelling while typing", default: true }],
  editorExtensions: () => [TaskList, TaskItem.configure({ nested: true })],
  kinds: [{ kind: "note", label: "New note", icon: "note" }],
  pageViews: [{ kind: "note", component: NotePane }],
  commands: [
    { id: "notes.new", title: "New note", keywords: ["create", "add"], run: (app) => app.create("note") },
    {
      id: "notes.duplicate",
      title: "Duplicate this note",
      keywords: ["copy", "clone"],
      when: (app) => openNote(app) !== null,
      run: (app) => void duplicate(app, openNote(app)!).catch((err) => app.notify(`Could not duplicate: ${err instanceof Error ? err.message : err}`)),
    },
  ],
};
