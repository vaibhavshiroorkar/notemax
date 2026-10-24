import { useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import type { Selection } from "@tiptap/pm/state";
import type * as Y from "yjs";
import { workspaceOf } from "@/data/scope";
import type { LinkHub } from "@/features/links/link-hub";
import { useOption } from "@/plugins/options";
import { registry } from "@/plugins/registry";
import { openContextMenu } from "@/ui/ContextMenu";
import { PAPER, Pages, paperSize, relayoutPages } from "./pages";

/**
 * A right click in a note works like in a word processor: on a selection it
 * keeps the selection, elsewhere it first moves the cursor there (or selects
 * the picture or link under the pointer), then opens the menu. A long press
 * on a phone never gets here: it is the phone's own (ui/longPress.ts).
 */
function openEditorMenu(editor: TiptapEditor, noteId: string, event: MouseEvent) {
  // Shift+right click keeps the browser's own menu, which has the spelling suggestions.
  if (event.shiftKey) return;
  event.preventDefault();
  const { view } = editor;
  let { clientX: x, clientY: y } = event;
  if (x === 0 && y === 0) {
    // From the keyboard: open at the cursor.
    const at = view.coordsAtPos(view.state.selection.from);
    x = at.left;
    y = at.bottom;
  } else {
    const hit = view.posAtCoords({ left: x, top: y });
    const { from, to } = view.state.selection;
    if (hit && !(hit.pos >= from && hit.pos <= to && from !== to)) {
      const node = hit.inside >= 0 ? view.state.doc.nodeAt(hit.inside) : null;
      if (node && node.isAtom && !node.isText) editor.chain().setNodeSelection(hit.inside).run();
      else editor.chain().setTextSelection(hit.pos).run();
    }
  }
  if (!view.hasFocus()) view.focus();
  openContextMenu({ type: "editor", editor, noteId }, x, y, workspaceOf(editor.view.dom));
}

export function Editor({
  doc,
  noteId,
  hub,
  initialContent,
  placeholder,
  layout = "infinite",
  onPages,
  onReady,
  editable = true,
}: {
  doc: Y.Doc;
  noteId: string;
  hub: LinkHub;
  /** Inserted only when the doc is empty, so it never duplicates on reload. */
  initialContent?: string;
  placeholder?: string;
  /** One long page, or sheets like a printed document. */
  layout?: "infinite" | "pages";
  /** How many sheets the note fills, while it is on pages. */
  onPages?: (count: number) => void;
  onReady?: (editor: TiptapEditor) => void;
  /** False for a page that takes no edits, like one shared with you to read. */
  editable?: boolean;
}) {
  const spellcheck = useOption("notes", "spellcheck");
  const paper = paperSize.use();
  // Read by the page layout on every measure, so changing them needs no new editor.
  const latest = useRef({ layout, paper, onPages });
  latest.current = { layout, paper, onPages };
  const editor = useEditor(
    {
      extensions: [
        // Yjs keeps its own undo history, so the built-in one must be off.
        StarterKit.configure({ undoRedo: false, codeBlock: false }),
        Collaboration.configure({ document: doc, field: "content" }),
        Placeholder.configure({ placeholder }),
        // Links, the / menu, to-do lists and anything else come from plugins.
        ...registry.editorExtensions({ noteId, hub }),
        Pages.configure({
          measure(view) {
            if (latest.current.layout !== "pages") return null;
            const sheet = view.dom.closest(".note");
            if (!sheet) return null;
            return { height: PAPER[latest.current.paper].height, offset: view.dom.getBoundingClientRect().top - sheet.getBoundingClientRect().top };
          },
          onPages: (count) => latest.current.onPages?.(count),
        }),
      ],
    },
    [doc],
  );

  // Use the instance useEditor returns rather than the one passed to onCreate:
  // React can mount twice in development, and onCreate may report an instance
  // that is never attached to the page. By the time this effect runs,
  // EditorContent (a child) has attached the view.
  useEffect(() => {
    if (!editor) return;
    if (initialContent && doc.getXmlFragment("content").length === 0) editor.commands.setContent(initialContent);
    onReady?.(editor);
    // Run once per editor instance; the callbacks are not meant to re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) relayoutPages(editor.view);
  }, [editor, layout, paper]);

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  // Set on the live element, so switching it in Settings needs no new editor.
  useEffect(() => {
    editor?.view.dom.setAttribute("spellcheck", String(spellcheck));
  }, [editor, spellcheck]);

  // A native listener: pictures and other node views are drawn through React
  // portals beside the editor, so a React handler here would miss clicks on them.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onMenu = (event: MouseEvent) => openEditorMenu(editor, noteId, event);
    dom.addEventListener("contextmenu", onMenu);
    return () => dom.removeEventListener("contextmenu", onMenu);
  }, [editor, noteId]);

  return <EditorContent editor={editor} className="editor" />;
}
