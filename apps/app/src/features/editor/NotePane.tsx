import { useEffect, useRef } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WELCOME_ID, renameNode } from "@notemax/core";
import { ChapterNav } from "@/features/books/ChapterNav";
import { Backlinks } from "@/features/links/Backlinks";
import { useLocalDoc } from "@/data/useLocalDoc";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { Editor } from "./Editor";
import { useBodyIndex } from "./useBodyIndex";
import { useRememberPosition } from "./usePosition";
import { welcomeContent } from "./welcome";
import "./editor.css";

// Tiptap's focus() waits for the next animation frame, so keys typed right after
// Enter would still land in the title. Focusing the view directly is immediate;
// focus("start") then places the cursor.
function focusBody(editor: TiptapEditor) {
  editor.view.focus();
  editor.commands.focus("start");
}

// Opening a note should not pull focus out of a field someone is typing in.
const isTyping = () => {
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
};

export function NotePane({ node, app, tree, hub, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const editorRef = useRef<TiptapEditor | null>(null);
  const focusWhenReady = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  const restorePosition = useRememberPosition(node.id);

  useEffect(() => onStatus(status), [status, onStatus]);
  useBodyIndex(local?.doc, workspaceDoc, node.id);

  if (openError) return <p className="error">Could not open this note: {openError}</p>;

  const parent = tree.items.get(tree.items.get(node.id)?.parentId ?? "");
  const book = parent?.kind === "book" ? parent : undefined;

  return (
    <article className="note" ref={articleRef}>
      {book && <ChapterNav book={book} chapterId={node.id} onOpen={(id) => hub.open(id)} />}
      <input
        className="note-title"
        value={node.title}
        placeholder="Untitled"
        aria-label="Title"
        // A new note starts with an empty title, so put the cursor there.
        autoFocus={node.title === ""}
        onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          // The body loads from storage asynchronously. If Enter comes first, move
          // the cursor as soon as the editor appears.
          if (editorRef.current) focusBody(editorRef.current);
          else focusWhenReady.current = true;
        }}
      />
      <PageHeader node={node} app={app} />
      {local && (
        <Editor
          doc={local.doc}
          noteId={node.id}
          hub={hub}
          initialContent={node.id === WELCOME_ID ? welcomeContent : undefined}
          placeholder="Start writing..."
          onReady={(editor) => {
            editorRef.current = editor;
            const returning = restorePosition(editor, articleRef.current?.closest(".main") ?? null);
            if (focusWhenReady.current) {
              focusWhenReady.current = false;
              focusBody(editor);
            } else if (returning && !isTyping()) {
              // Back to a note: the cursor is where it was, ready to keep writing.
              editor.view.focus();
            }
            onReady();
          }}
        />
      )}
      {local && <Backlinks tree={tree} noteId={node.id} hub={hub} />}
    </article>
  );
}
