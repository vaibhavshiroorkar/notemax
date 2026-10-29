import { useEffect, useState } from "react";
import { bookOf } from "@/features/books/reading";
import { activeEditor } from "@/features/editor/active";
import { findAll } from "@/features/find/find";
import { finding } from "@/features/find/FindBar";
import { createStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { myPostOf, myPostedSources } from "./api";
import { Avatar, nameOf, useLoad, whenSent } from "./bits";
import { messageOf } from "@/ui/format";
import { markNotesRead, notesOn, removeNote, NOTES_NOT_SET_UP, type ReaderNote } from "./notes";

/** Pages this person has posted, by the page id the post came from. Filled once signed in. */
export const postedSources = createStore<ReadonlySet<string>>(new Set());

export async function loadPostedSources() {
  postedSources.set(new Set(await myPostedSources()));
}

/** The page a post would come from: the book for a chapter, else the page itself. */
export const sourceOf = (app: AppContext): string | null => (app.activeId ? (bookOf(app.tree, app.activeId)?.id ?? app.activeId) : null);

type Editorish = HTMLElement & { editor?: import("@tiptap/react").Editor };

/** The longest line of a quote, which is what most likely still reads the same in the page. */
const anchorOf = (quote: string) =>
  quote
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .sort((a, b) => b.length - a.length)[0]
    ?.slice(0, 200) ?? "";

/**
 * Opens the page the lines came from and picks them, with Find open on them
 * so they stay lit. The page's text loads a moment after it opens, so look for a while.
 */
async function goToQuote(app: AppContext, pageId: string, quote: string) {
  app.open(pageId);
  const anchor = anchorOf(quote);
  if (!anchor) return;
  for (let tries = 0; tries < 30; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const dom of document.querySelectorAll<Editorish>(".main .ProseMirror")) {
      const editor = dom.editor;
      if (!editor || editor.isDestroyed) continue;
      const [match] = findAll(editor.state.doc, anchor, false);
      if (!match) continue;
      editor.chain().setTextSelection(match).scrollIntoView().run();
      activeEditor.set(editor);
      finding.set({ replace: false });
      return;
    }
  }
  app.notify("Those lines have changed since the reader picked them.");
}

function NoteRow({ app, note, sourceId, onRemoved }: { app: AppContext; note: ReaderNote; sourceId: string; onRemoved(): void }) {
  const [problem, setProblem] = useState<string>();
  // A note on a chapter lands on the chapter, when the post said which page each part came from.
  const target = note.part_id && app.tree.byId.has(note.part_id) ? note.part_id : sourceId;
  const where = target !== sourceId ? app.tree.byId.get(target)?.title || "Untitled" : null;
  return (
    <li className="reader-note" data-unread={!note.read_at || undefined}>
      <header className="reader-note-head">
        <Avatar profile={note.profile} size={20} />
        <strong>{nameOf(note.profile)}</strong>
        <span className="community-meta">{whenSent(note.created_at)}</span>
      </header>
      {note.quote && (
        <button className="reader-note-jump" title="Go to these lines" onClick={() => void goToQuote(app, target, note.quote)}>
          <blockquote>{note.quote}</blockquote>
          {where && <span className="community-meta">in {where}</span>}
        </button>
      )}
      <p>{note.body}</p>
      <button className="link-button community-remove" onClick={() => void removeNote(note.id).then(onRemoved, (failure) => setProblem(messageOf(failure)))}>
        Delete
      </button>
      {problem && <p className="community-error">{problem}</p>}
    </li>
  );
}

/**
 * Private notes readers left on the post of the open page, newest first,
 * each with the lines it is about. Shown only for pages that are posted.
 */
export function ReaderNotesPanel({ app }: { app: AppContext }) {
  const sourceId = sourceOf(app)!;
  const { data, error, reload } = useLoad(async () => {
    const post = await myPostOf(sourceId);
    return post ? await notesOn(post.id) : [];
  }, [sourceId]);
  const notes = data ?? [];
  // Seen once shown here.
  useEffect(() => {
    const unread = notes.filter((note) => !note.read_at).map((note) => note.id);
    if (unread.length) void markNotesRead(unread).catch(() => {});
  }, [notes]);
  if (error === NOTES_NOT_SET_UP) return <p className="panel-note">Private notes need the server's reader notes set up.</p>;
  if (error) return <p className="community-error">{error}</p>;
  if (!data) return null;
  if (!notes.length) return <p className="panel-note">No private notes from readers yet.</p>;
  return (
    <ul className="reader-note-list reader-notes-panel">
      {notes.map((note) => (
        <NoteRow key={note.id} app={app} note={note} sourceId={sourceId} onRemoved={reload} />
      ))}
    </ul>
  );
}
