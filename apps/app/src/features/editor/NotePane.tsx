import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { WELCOME_ID, renameNode } from "@notemax/core";
import { ChapterNav } from "@/features/books/ChapterNav";
import { useLocalDoc } from "@/data/useLocalDoc";
import { useVersions } from "@/features/history/versions";
import { useShare } from "@/features/share/useShare";
import { activeEditor } from "./active";
import { useOption } from "@/plugins/options";
import { PageFooter, PageHeader } from "@/plugins/PageHeader";
import { registry } from "@/plugins/registry";
import type { PageProps } from "@/plugins/types";
import { Editor } from "./Editor";
import { KeyboardBar } from "./KeyboardBar";
import { PAGE_GAP, PAGE_MARGIN, PAPER, paperSize } from "./pages";
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

const WIDE_ENOUGH = "(min-width: 900px)";

function useRoomForSheets() {
  const [wide, setWide] = useState(() => matchMedia(WIDE_ENOUGH).matches);
  useEffect(() => {
    const query = matchMedia(WIDE_ENOUGH);
    const onChange = () => setWide(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return wide;
}

export function NotePane({ node, app, tree, hub, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const pagesByDefault = useOption("notes", "pages");
  const roomForSheets = useRoomForSheets();
  // The note's own choice wins over the setting. A window too narrow for a sheet shows one long page.
  const chosen = node.props.layout === "pages" || node.props.layout === "infinite" ? node.props.layout : pagesByDefault ? "pages" : "infinite";
  const layout = roomForSheets ? chosen : "infinite";
  const paper = PAPER[paperSize.use()];
  const [pages, setPages] = useState(1);
  const editorRef = useRef<TiptapEditor | null>(null);
  // The same editor as a value, for the phone's keyboard bar.
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const focusWhenReady = useRef(false);
  const articleRef = useRef<HTMLElement>(null);
  const restorePosition = useRememberPosition(node.id);

  useEffect(() => onStatus(status), [status, onStatus]);
  useBodyIndex(local?.doc, workspaceDoc, node.id);
  useVersions(local?.doc, node.id);
  useShare(local?.doc, node, workspaceDoc);
  // Panels beside the note, like Format, act on this editor while it is on screen.
  useEffect(() => {
    if (!editor) return;
    activeEditor.set(editor);
    return () => {
      if (activeEditor.get() === editor) activeEditor.set(null);
    };
  }, [editor]);

  if (openError) return <p className="error">Could not open this note: {openError}</p>;

  const inBook = tree.items.get(tree.items.get(node.id)?.parentId ?? "")?.kind === "book";

  return (
    <article
      className="note"
      ref={articleRef}
      data-layout={layout}
      style={
        layout === "pages"
          ? ({ "--sheet-width": `${paper.width}px`, "--sheet-height": `${paper.height}px`, "--sheet-margin": `${PAGE_MARGIN}px`, "--sheet-gap": `${PAGE_GAP}px`, "--sheets": pages } as CSSProperties)
          : undefined
      }
    >
      {layout === "pages" &&
        Array.from({ length: pages }, (_, i) => (
          <span key={i} className="page-number" aria-hidden="true" style={{ top: i * (paper.height + PAGE_GAP) + paper.height - PAGE_MARGIN / 2 - 8 }}>
            {i + 1}
          </span>
        ))}
      {inBook && registry.isOn("books") && <ChapterNav tree={tree} chapterId={node.id} onOpen={(id) => hub.open(id)} />}
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
          layout={layout}
          onPages={setPages}
          onReady={(editor) => {
            editorRef.current = editor;
            setEditor(editor);
            const returning = restorePosition(editor, articleRef.current?.closest(".page-scroll") ?? null);
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
      {local && <PageFooter node={node} app={app} />}
      {editor && <KeyboardBar editor={editor} />}
    </article>
  );
}
