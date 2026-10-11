import { useEffect, useRef } from "react";
import * as Y from "yjs";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WELCOME_ID, extractLinks, renameNode, setLinks, type SaveStatus, type Tree, type TreeNode } from "@notemax/core";
import { Backlinks } from "./Backlinks";
import { Editor } from "./Editor";
import type { LinkHub } from "./links/link-hub";
import { useLocalDoc } from "./useLocalDoc";

const welcomeContent = `
  <p>This note lives in your <strong>Inbox</strong>. Use the sidebar to add books, chapters and more notes.</p>
  <p>Everything is saved on this device. Try <strong>Ctrl+B</strong>, <code>#</code> plus space for a heading, or <code>-</code> plus space for a list.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed at the bottom.</p>
`;

// Tiptap's focus() waits for the next animation frame, so keys typed right after
// Enter would still land in the title. Focusing the view directly is immediate;
// focus("start") then places the cursor.
function focusBody(editor: TiptapEditor) {
  editor.view.focus();
  editor.commands.focus("start");
}

// How long typing must pause before the link list is updated. Links change
// rarely, so there is no need to scan the body on every keystroke.
const LINK_SCAN_MS = 500;

/** Keeps the workspace's copy of this note's links in step with its body. */
function useLinkIndex(body: Y.Doc | undefined, workspaceDoc: Y.Doc, noteId: string) {
  useEffect(() => {
    if (!body) return;
    const fragment = body.getXmlFragment("content");
    const scan = () => setLinks(workspaceDoc, noteId, extractLinks(fragment));
    // Also on open, which repairs the list if it went stale, for example after
    // two devices edited this note at the same time.
    scan();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        scan();
      }, LINK_SCAN_MS);
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
  useLinkIndex(local?.doc, workspaceDoc, node.id);

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
          noteId={node.id}
          hub={hub}
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
      {local && <Backlinks tree={tree} noteId={node.id} hub={hub} />}
    </article>
  );
}
