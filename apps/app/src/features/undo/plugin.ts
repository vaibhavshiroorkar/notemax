import { treeUndo } from "@notemax/core";
import type * as Y from "yjs";
import type { AppContext, Plugin } from "@/plugins/types";

// Notes, titles and boards have their own undo while they have the keyboard.
// This one is for everything else: new pages, moves, renames, tags, the trash.
let manager: Y.UndoManager | null = null;

function step(app: AppContext, back: boolean) {
  if (!manager) return;
  const stack = back ? manager.undoStack : manager.redoStack;
  if (!stack.length) return app.notify(back ? "Nothing to undo" : "Nothing to redo");
  if (back) manager.undo();
  else manager.redo();
  app.notify(back ? "Undone" : "Redone", { label: back ? "Redo" : "Undo", run: () => step(app, !back) });
}

/** True while typing goes somewhere with its own undo, like a note or a text box. */
const ownUndo = (target: EventTarget | null) => target instanceof Element && !!target.closest("input, textarea, select, [contenteditable='true'], .ProseMirror, .excalidraw");

export const undoPlugin: Plugin = {
  id: "undo",
  name: "Undo",
  description: "Ctrl+Z and Ctrl+Y for changes to your pages outside a note, like moves, renames and the trash",
  required: true,
  shortcutHints: [
    { title: "Undo a change to your pages", keys: "Mod+Z" },
    { title: "Redo it", keys: "Mod+Shift+Z" },
  ],
  commands: [
    { id: "undo.undo", title: "Undo the last change to your pages", keywords: ["undo", "back", "revert"], run: (app) => step(app, true) },
    { id: "undo.redo", title: "Redo the last change to your pages", keywords: ["redo", "again"], run: (app) => step(app, false) },
  ],
  start(app) {
    manager = treeUndo(app.doc);
    window.addEventListener("keydown", (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || ownUndo(event.target)) return;
      const key = event.key.toLowerCase();
      const back = key === "z" && !event.shiftKey;
      const again = (key === "z" && event.shiftKey) || key === "y";
      if (!back && !again) return;
      event.preventDefault();
      step(app, back);
    });
  },
};
