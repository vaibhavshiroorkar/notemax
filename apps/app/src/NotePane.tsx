import { useEffect, useRef } from "react";
import * as Y from "yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import {
  WELCOME_ID,
  countWords,
  extractLinks,
  renameNode,
  setLinks,
  setWords,
  type SaveStatus,
  type Tree,
  type TreeNode,
} from "@notemax/core";
import { Backlinks } from "./Backlinks";
import { Editor } from "./Editor";
import { Icon } from "./Icon";
import type { LinkHub } from "./links/link-hub";
import { useLocalDoc } from "./useLocalDoc";

const welcomeContent = `
  <p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed at the bottom.</p>
`;

// Tiptap's focus() waits for the next animation frame, so keys typed right after
// Enter would still land in the title. Focusing the view directly is immediate;
// focus("start") then places the cursor.
function focusBody(editor: TiptapEditor) {
  editor.view.focus();
  editor.commands.focus("start");
}

// How long typing must pause before links and words are recounted. There is
// no need to scan the body on every keystroke.
const SCAN_MS = 500;

/** Keeps the workspace's copy of this note's links and word count in step with its body. */
function useBodyIndex(body: Y.Doc | undefined, workspaceDoc: Y.Doc, noteId: string) {
  useEffect(() => {
    if (!body) return;
    const fragment = body.getXmlFragment("content");
    const scan = () =>
      workspaceDoc.transact(() => {
        setLinks(workspaceDoc, noteId, extractLinks(fragment));
        setWords(workspaceDoc, noteId, countWords(fragment));
      });
    // Also on open, which repairs the list if it went stale, for example after
    // two devices edited this note at the same time.
    scan();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        scan();
      }, SCAN_MS);
    };
    body.on("update", onUpdate);
    return () => {
      body.off("update", onUpdate);
      // Switching notes must not drop a link typed in the last half second.
      if (timer) {
        clearTimeout(timer);
        scan();
      }
    };
  }, [body, workspaceDoc, noteId]);
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
      {book && (
        <nav className="note-book" aria-label="Book">
          <button className="note-book-link" onClick={() => hub.open(book.id)}>
            <Icon name="book" />
            <span>{book.title || "Untitled book"}</span>
          </button>
          <span>
            Chapter {book.children.findIndex((chapter) => chapter.id === node.id) + 1} of {book.children.length}
          </span>
        </nav>
      )}
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
