import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { savedStore } from "@/platform/store";
import { Icon } from "@/ui/Icon";
import { phoneBar } from "@/ui/phoneBar";
import type { Post } from "./api";
import { useLoad } from "./bits";
import { messageOf, plural } from "@/ui/format";
import { MAX_NOTE, MAX_QUOTE, NOTES_NOT_SET_UP, notesOn, removeNote, sendNote, type ReaderNote } from "./notes";

// Reading someone's post: comfortable text, where you are in it, and ways to
// answer the lines you pick, in public (a comment) or only to the author.

interface Look {
  /** Text size in pixels. */
  size: number;
  serif: boolean;
  wide: boolean;
}

const look = savedStore<Look>("readerLook", { size: 18, serif: true, wide: false });
/** How far into each post the reader got, as a share of its height, by post id. Kept for the last 50. */
const places = savedStore<Record<string, number>>("readerPlaces", {});

export const readingMinutes = (words: number) => Math.max(1, Math.round(words / 230));

/** The style a post's text takes from the reader's choices. */
export function useReaderStyle(): CSSProperties {
  const { size, serif, wide } = look.use();
  return {
    "--reader-size": `${size}px`,
    "--reader-font": serif ? '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' : "system-ui, sans-serif",
    "--reader-width": wide ? "860px" : "680px",
  } as CSSProperties;
}

/**
 * Text size, serif or not, narrow or wide, and a thin line along the top
 * showing how far down the post is read. `post` is the post's own element;
 * the page around it is what scrolls. On a phone the buttons sit in the
 * third bar at the top, where a note has its formatting.
 */
export function ReadingBar({ post, postId }: { post: RefObject<HTMLElement | null>; postId: string }) {
  const current = look.use();
  const slot = phoneBar.use();
  const [done, setDone] = useState(0);
  const set = (change: Partial<Look>) => look.set({ ...look.get(), ...change });

  // Back where the reader left off, then remember the place as they read.
  useEffect(() => {
    const box = post.current?.closest<HTMLElement>(".page-scroll");
    if (!box) return;
    const kept = places.get()[postId];
    if (kept && kept > 0.02 && kept < 0.98) requestAnimationFrame(() => (box.scrollTop = kept * (box.scrollHeight - box.clientHeight)));
    let frame = 0;
    let saveAt = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const share = box.scrollHeight > box.clientHeight ? box.scrollTop / (box.scrollHeight - box.clientHeight) : 1;
        setDone(share);
        clearTimeout(saveAt);
        saveAt = window.setTimeout(() => {
          const all = { ...places.get(), [postId]: share };
          const kept = Object.keys(all);
          if (kept.length > 50) delete all[kept[0]];
          places.set(all);
        }, 400);
      });
    };
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      box.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      clearTimeout(saveAt);
    };
  }, [post, postId]);

  const tools = (
    <div className="reader-bar" role="toolbar" aria-label="Reading">
      <button className="icon-button" aria-label="Smaller text" title="Smaller text" disabled={current.size <= 14} onClick={() => set({ size: current.size - 1 })}>
        A-
      </button>
      <button className="icon-button" aria-label="Bigger text" title="Bigger text" disabled={current.size >= 26} onClick={() => set({ size: current.size + 1 })}>
        A+
      </button>
      <button className="icon-button reader-serif" aria-pressed={current.serif} title="Book type" onClick={() => set({ serif: !current.serif })}>
        Serif
      </button>
      {/* A phone's column is the screen already. */}
      {!slot && (
        <button className="icon-button" aria-pressed={current.wide} aria-label="Wide column" title="Wide column" onClick={() => set({ wide: !current.wide })}>
          <Icon name="expand" />
        </button>
      )}
    </div>
  );
  return (
    <>
      <div className="reader-progress" style={{ transform: `scaleX(${done})` }} aria-hidden="true" />
      {slot ? createPortal(tools, slot) : tools}
    </>
  );
}

export interface Picked {
  quote: string;
  part: number;
}

/**
 * The lines picked in a post, with buttons beside them: a private note to the
 * author, or a public comment quoting them. Parts carry data-part, so the note
 * knows which chapter the lines are in.
 */
export function SelectionButtons({ root, canNote, onNote, onComment }: { root: RefObject<HTMLElement | null>; canNote: boolean; onNote(picked: Picked): void; onComment(picked: Picked): void }) {
  const [at, setAt] = useState<{ x: number; y: number; picked: Picked } | null>(null);
  const slot = phoneBar.use();
  useEffect(() => {
    const read = () => {
      const selection = document.getSelection();
      const range = selection && !selection.isCollapsed && selection.rangeCount ? selection.getRangeAt(0) : null;
      const body = range && (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest<HTMLElement>(".community-part");
      const quote = selection?.toString().trim() ?? "";
      if (!range || !body || !root.current?.contains(body) || quote.length < 2) return setAt(null);
      const rect = range.getBoundingClientRect();
      setAt({ x: rect.left + rect.width / 2, y: rect.top, picked: { quote: quote.slice(0, MAX_QUOTE), part: Number(body.dataset.part ?? 0) } });
    };
    // After the press ends, so the selection is final.
    const later = () => setTimeout(read, 0);
    document.addEventListener("mouseup", later);
    document.addEventListener("keyup", later);
    document.addEventListener("touchend", later);
    const hide = () => setAt(null);
    root.current?.addEventListener("scroll", hide, { passive: true });
    const box = root.current;
    return () => {
      document.removeEventListener("mouseup", later);
      document.removeEventListener("keyup", later);
      document.removeEventListener("touchend", later);
      box?.removeEventListener("scroll", hide);
    };
  }, [root]);
  if (!at) return null;
  const pick = (run: (picked: Picked) => void) => () => {
    run(at.picked);
    setAt(null);
    document.getSelection()?.removeAllRanges();
  };
  // A phone shows its own menu over picked text, so there the buttons wait in the bar at the top.
  const buttons = (
    <div className="reader-picked" data-in-bar={slot ? "" : undefined} style={slot ? undefined : { left: at.x, top: at.y }} role="toolbar" aria-label="Picked lines" onMouseDown={(event) => event.preventDefault()}>
      {canNote && (
        <button className="button" onClick={pick(onNote)}>
          <Icon name="lock" /> Note to author
        </button>
      )}
      <button className="button" onClick={pick(onComment)}>
        <Icon name="quote" /> Comment
      </button>
    </div>
  );
  return slot ? createPortal(buttons, slot) : buttons;
}

function NoteItem({ note, onRemoved }: { note: ReaderNote; onRemoved(): void }) {
  const [problem, setProblem] = useState<string>();
  return (
    <li className="reader-note">
      {note.quote && <blockquote>{note.quote}</blockquote>}
      <p>{note.body}</p>
      <button className="link-button community-remove" onClick={() => void removeNote(note.id).then(onRemoved, (failure) => setProblem(messageOf(failure)))}>
        Delete
      </button>
      {problem && <p className="community-error">{problem}</p>}
    </li>
  );
}

/**
 * A note only the author sees, about the post or about the lines picked in it.
 * The reader sees their own notes here too. The author has theirs beside the page.
 */
export function NoteToAuthor({ post, picked, onClearPick, partIds }: { post: Post; picked: Picked | null; onClearPick(): void; partIds: string[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const box = useRef<HTMLTextAreaElement>(null);
  const { data, error, reload } = useLoad(() => notesOn(post.id), [post.id]);
  useEffect(() => {
    if (!picked) return;
    setOpen(true);
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [picked]);
  if (error === NOTES_NOT_SET_UP) return null;
  const mine = data ?? [];
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setProblem(undefined);
    try {
      await sendNote({ postId: post.id, part: picked?.part ?? 0, partId: partIds[picked?.part ?? 0] ?? "", quote: picked?.quote ?? "", body: text });
      setText("");
      onClearPick();
      setOpen(false);
      reload();
    } catch (failure) {
      setProblem(messageOf(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="reader-notes" aria-label="Private notes to the author">
      {!open ? (
        <button className="link-button" onClick={() => setOpen(true)}>
          <Icon name="lock" /> Send the author a private note
        </button>
      ) : (
        <form
          className="reader-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <p className="community-meta">Only the author sees this.</p>
          {picked && (
            <blockquote className="reader-note-quote">
              {picked.quote}
              <button type="button" className="icon-button" aria-label="Leave out the picked lines" onClick={onClearPick}>
                <Icon name="close" />
              </button>
            </blockquote>
          )}
          <textarea ref={box} aria-label="Private note to the author" placeholder="A thought, a fix, a question..." rows={3} maxLength={MAX_NOTE} value={text} onChange={(event) => setText(event.target.value)} />
          <div className="reader-note-actions">
            <button
              type="button"
              className="button"
              onClick={() => {
                setOpen(false);
                onClearPick();
              }}
            >
              Cancel
            </button>
            <button className="button button-primary" type="submit" disabled={busy || !text.trim()}>
              Send privately
            </button>
          </div>
          {problem && <p className="community-error">{problem}</p>}
        </form>
      )}
      {mine.length > 0 && (
        <>
          <h3 className="community-meta">Your {plural(mine.length, "private note")} to the author</h3>
          <ul className="reader-note-list">
            {mine.map((note) => (
              <NoteItem key={note.id} note={note} onRemoved={reload} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
