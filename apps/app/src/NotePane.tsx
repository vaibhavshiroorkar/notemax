import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WELCOME_ID, renameNode, type SaveStatus, type TreeNode } from "@notemax/core";
import { Editor } from "./Editor";
import { useLocalDoc } from "./useLocalDoc";

const welcomeContent = `
  <p>This note lives in your <strong>Inbox</strong>. Use the sidebar to add books, chapters and more notes.</p>
  <p>Everything is saved on this device. Try <strong>Ctrl+B</strong>, <code>#</code> plus space for a heading, or <code>-</code> plus space for a list.</p>
`;

// Tiptap's focus() waits for the next animation frame, so keys typed right after
// Enter would still land in the title. Focusing the view directly is immediate;
// focus("start") then places the cursor.
function focusBody(editor: TiptapEditor) {
  editor.view.focus();
  editor.commands.focus("start");
}

export function NotePane({
  node,
  workspaceDoc,
  onStatus,
  onReady,
}: {
  node: TreeNode;
  workspaceDoc: Y.Doc;
  onStatus(status: SaveStatus): void;
  onReady(): void;
}) {
  const { local, status, openError } = useLocalDoc(node.id);
  const editorRef = useRef<TiptapEditor | null>(null);
  const focusWhenReady = useRef(false);

  useEffect(() => onStatus(status), [status, onStatus]);

  if (openError) return <p className="error">Could not open this note: {openError}</p>;

  return (
    <article className="note">
      <input
        className="note-title"
        value={node.title}
        placeholder={node.kind === "book" ? "Untitled book" : "Untitled"}
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
      {local && (
        <Editor
          doc={local.doc}
          initialContent={node.id === WELCOME_ID ? welcomeContent : undefined}
          placeholder={node.kind === "book" ? "What is this book about?" : "Start writing..."}
          onReady={(editor) => {
            editorRef.current = editor;
            if (focusWhenReady.current) {
              focusWhenReady.current = false;
              focusBody(editor);
            }
            onReady();
          }}
        />
      )}
    </article>
  );
}
