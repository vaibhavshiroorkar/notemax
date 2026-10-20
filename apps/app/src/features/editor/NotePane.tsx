import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WELCOME_ID, renameNode, type SaveStatus, type Tree, type TreeNode } from "@notemax/core";
import { ChapterNav } from "@/features/books/ChapterNav";
import { Backlinks } from "@/features/links/Backlinks";
import type { LinkHub } from "@/features/links/link-hub";
import { useLocalDoc } from "@/data/useLocalDoc";
import { Editor } from "./Editor";
import { useBodyIndex } from "./useBodyIndex";
import { welcomeContent } from "./welcome";
import "./editor.css";

// Tiptap's focus() waits for the next animation frame, so keys typed right after
// Enter would still land in the title. Focusing the view directly is immediate;
// focus("start") then places the cursor.
function focusBody(editor: TiptapEditor) {
  editor.view.focus();
  editor.commands.focus("start");
}

export function NotePane({
  node,
  tree,
  hub,
  workspaceDoc,
  onStatus,
  onReady,
}: {
  node: TreeNode;
  tree: Tree;
  hub: LinkHub;
  workspaceDoc: Y.Doc;
  onStatus(status: SaveStatus): void;
  onReady(): void;
}) {
  const { local, status, openError } = useLocalDoc(node.id);
  const editorRef = useRef<TiptapEditor | null>(null);
  const focusWhenReady = useRef(false);

  useEffect(() => onStatus(status), [status, onStatus]);
  useBodyIndex(local?.doc, workspaceDoc, node.id);

  if (openError) return <p className="error">Could not open this note: {openError}</p>;

  const parent = tree.items.get(tree.items.get(node.id)?.parentId ?? "");
  const book = parent?.kind === "book" ? parent : undefined;

  return (
    <article className="note">
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
      {local && (
        <Editor
          doc={local.doc}
          noteId={node.id}
          hub={hub}
          initialContent={node.id === WELCOME_ID ? welcomeContent : undefined}
          placeholder="Start writing..."
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
      {local && <Backlinks tree={tree} noteId={node.id} hub={hub} />}
    </article>
  );
}
