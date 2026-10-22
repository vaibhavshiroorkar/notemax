import { TaskItem, TaskList } from "@tiptap/extension-list";
import type { AppContext, Plugin } from "@/plugins/types";
import { duplicate } from "./duplicate";
import { EditorSection } from "./EditorSection";
import { LAYOUT_MENU, layoutOf, toggleLayout } from "./layout";
import { LayoutSetting } from "./LayoutSetting";
import { WordPaste } from "./word-paste";
import { Indent, LineSpacing, ParenthesisList } from "./writing";
import { EDITOR_MENU } from "./menu";
import { NotePane } from "./NotePane";

const openNote = (app: AppContext) => (app.activeId && app.tree.byId.get(app.activeId)?.kind === "note" ? app.activeId : null);

export const notesPlugin: Plugin = {
  id: "notes",
  name: "Notes",
  description: "Writing pages",
  required: true,
  pageSettings: [{ id: "notes.layout", kinds: ["note"], component: LayoutSetting }],
  settings: [{ id: "editor", order: 20, title: "Editor", icon: "text", keywords: ["writing", "typing", "notes", "pages", "paper", "layout"], component: EditorSection }],
  options: [
    { id: "spellcheck", label: "Check spelling while typing", section: "editor", quick: true, default: true },
    {
      id: "pages",
      label: "Show notes as pages",
      description: "Sheets of paper like a printed document, instead of one long page. A note can choose for itself in the right sidebar or its menu.",
      section: "editor",
      quick: true,
      default: false,
    },
    { id: "statusWords", label: "Show the word count in the status bar", description: "Words and reading time of the open note", section: "editor", quick: true, default: true },
  ],
  // Keys the editor itself handles (Tiptap's defaults), listed with the command shortcuts.
  shortcutHints: [
    { title: "Bold", keys: "Mod+B" },
    { title: "Italic", keys: "Mod+I" },
    { title: "Underline", keys: "Mod+U" },
    { title: "Strikethrough", keys: "Mod+Shift+S" },
    { title: "Inline code", keys: "Mod+E" },
    { title: "Heading 1, 2 or 3", keys: "Mod+Alt+1" },
    { title: "Bulleted list", keys: "Mod+Shift+8" },
    { title: "Numbered list", keys: "Mod+Shift+7" },
    { title: "To-do list", keys: "Mod+Shift+9" },
    { title: "Quote", keys: "Mod+Shift+B" },
    { title: "Code block", keys: "Mod+Alt+C" },
    { title: "Line break inside a block", keys: "Shift+Enter" },
    { title: "Indent a paragraph, or nest a list item", keys: "Tab" },
    { title: "Outdent it again", keys: "Shift+Tab" },
    { title: "Undo", keys: "Mod+Z" },
    { title: "Redo", keys: "Mod+Shift+Z" },
    { title: "Paste as plain text", keys: "Mod+Shift+V" },
    { title: "The browser's own menu, with spelling suggestions", keys: "Shift+Right click" },
  ],
  contentExtensions: () => [TaskList, TaskItem.configure({ nested: true }), Indent, LineSpacing],
  editorExtensions: () => [ParenthesisList, WordPaste],
  kinds: [{ kind: "note", label: "New note", icon: "note" }],
  pageViews: [{ kind: "note", component: NotePane }],
  contextMenu: [
    ...EDITOR_MENU,
    LAYOUT_MENU,
    {
      id: "notes.duplicate",
      title: "Duplicate",
      group: "duplicate",
      icon: "copy",
      targets: ["page"],
      when: (target) => target.type === "page" && target.node.kind === "note",
      run(target, app) {
        if (target.type !== "page") return;
        void duplicate(app, target.node.id).catch((err) => app.notify(`Could not duplicate: ${err instanceof Error ? err.message : err}`));
      },
    },
  ],
  commands: [
    {
      id: "notes.layout",
      title: "Switch this note between pages and one long page",
      keywords: ["layout", "paper", "print", "infinite", "sheets"],
      shortcut: "Mod+Alt+P",
      when: (app) => openNote(app) !== null,
      run(app) {
        const node = app.tree.byId.get(openNote(app)!)!;
        const next = layoutOf(node) === "pages" ? "One long page" : "Pages";
        toggleLayout(app, node);
        app.notify(next);
      },
    },
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
