import { useEffect } from "react";
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Placeholder } from "@tiptap/extensions";
import type * as Y from "yjs";
import type { LinkHub } from "@/features/links/link-hub";
import { useOption } from "@/plugins/options";
import { registry } from "@/plugins/registry";

export function Editor({
  doc,
  noteId,
  hub,
  initialContent,
  placeholder,
  onReady,
}: {
  doc: Y.Doc;
  noteId: string;
  hub: LinkHub;
  /** Inserted only when the doc is empty, so it never duplicates on reload. */
  initialContent?: string;
  placeholder?: string;
  onReady?: (editor: TiptapEditor) => void;
}) {
  const spellcheck = useOption("notes", "spellcheck");
  const editor = useEditor(
    {
      extensions: [
        // Yjs keeps its own undo history, so the built-in one must be off.
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: doc, field: "content" }),
        Placeholder.configure({ placeholder }),
        // Links, the / menu, to-do lists and anything else come from plugins.
        ...registry.editorExtensions({ noteId, hub }),
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

  // Set on the live element, so switching it in Settings needs no new editor.
  useEffect(() => {
    editor?.view.dom.setAttribute("spellcheck", String(spellcheck));
  }, [editor, spellcheck]);

  return <EditorContent editor={editor} className="editor" />;
}
