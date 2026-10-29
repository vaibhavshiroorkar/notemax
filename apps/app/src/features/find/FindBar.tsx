import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { activeEditor } from "@/features/editor/active";
import { createStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { findState, replaceAll, replaceCurrent, setQuery, step } from "./find";

/** Open with Replace showing or not, or null while closed. */
export const finding = createStore<{ replace: boolean } | null>(null);

const shown = (editor: Editor | null): editor is Editor => !!editor && !editor.isDestroyed && editor.view.dom.isConnected && editor.view.dom.offsetParent !== null;

/**
 * The note to search: the one last written in, or else the first one on
 * screen. Tiptap keeps each editor on its element, which is how the second is found.
 */
export function noteToSearch(): Editor | null {
  const last = activeEditor.get();
  if (shown(last)) return last;
  for (const dom of document.querySelectorAll<HTMLElement & { editor?: Editor }>(".main .ProseMirror")) if (shown(dom.editor ?? null)) return dom.editor!;
  return null;
}

/** Find, and Replace, in the open note: Enter for the next match, Shift+Enter for the one before. */
export function FindBar({ app }: { app: AppContext }) {
  const open = finding.use();
  const [query, setQueryText] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [, redraw] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  // Opening again while open picks the words already selected in the note, as editors do.
  useEffect(() => {
    if (!open) return;
    const target = noteToSearch();
    setEditor(target);
    const selected = target && !target.state.selection.empty ? target.state.doc.textBetween(target.state.selection.from, target.state.selection.to, " ") : "";
    if (selected && !selected.includes("\n") && selected.length < 200) setQueryText(selected);
    requestAnimationFrame(() => input.current?.select());
  }, [open]);

  useEffect(() => {
    if (!open || !editor) return;
    setQuery(editor, query, matchCase);
    redraw((n) => n + 1);
    const onChange = () => redraw((n) => n + 1);
    editor.on("transaction", onChange);
    return () => {
      editor.off("transaction", onChange);
      setQuery(editor, "", false);
    };
  }, [open, editor, query, matchCase]);

  // The bar belongs to its note: it goes when the note closes, and Esc closes it from anywhere.
  useEffect(() => {
    if (!open || !editor) return;
    const gone = () => finding.set(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && finding.set(null);
    editor.on("destroy", gone);
    window.addEventListener("keydown", onKey);
    return () => {
      editor.off("destroy", gone);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, editor]);

  if (!open) return null;
  const { matches, current } = editor ? findState(editor) : { matches: [], current: -1 };
  const close = (focusNote = true) => {
    finding.set(null);
    if (focusNote && shown(editor)) editor.commands.focus();
  };
  const go = (by: 1 | -1) => editor && step(editor, by);
  const count = !query ? "" : matches.length ? `${current + 1} of ${matches.length}` : "No matches";

  return (
    <div className="find-bar" role="search" aria-label="Find in this note">
      <div className="find-row">
        <button className="icon-button" aria-label={open.replace ? "Hide Replace" : "Show Replace"} aria-expanded={open.replace} title="Replace (Ctrl+H)" onClick={() => finding.set({ replace: !open.replace })}>
          <Icon name={open.replace ? "chevron-down" : "chevron-right"} />
        </button>
        <input
          ref={input}
          className="find-input"
          aria-label="Find"
          placeholder={editor ? "Find" : "Open a note to search it"}
          disabled={!editor}
          value={query}
          onChange={(event) => setQueryText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              go(event.shiftKey ? -1 : 1);
            } else if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        />
        <span className="find-count" aria-live="polite">
          {count}
        </span>
        <button className="icon-button find-case" aria-label="Match case" aria-pressed={matchCase} title="Match case" onClick={() => setMatchCase(!matchCase)}>
          Aa
        </button>
        <button className="icon-button" aria-label="Previous match" title="Previous (Shift+Enter)" disabled={!matches.length} onClick={() => go(-1)}>
          <Icon name="chevron-up" />
        </button>
        <button className="icon-button" aria-label="Next match" title="Next (Enter)" disabled={!matches.length} onClick={() => go(1)}>
          <Icon name="chevron-down" />
        </button>
        <button className="icon-button" aria-label="Close find" title="Close (Esc)" onClick={() => close()}>
          <Icon name="close" />
        </button>
      </div>
      {open.replace && (
        <div className="find-row find-replace">
          <input
            className="find-input"
            aria-label="Replace with"
            placeholder="Replace with"
            disabled={!editor}
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && editor) {
                event.preventDefault();
                replaceCurrent(editor, replacement);
              } else if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
          />
          <button className="button" disabled={!matches.length} onClick={() => editor && replaceCurrent(editor, replacement)}>
            Replace
          </button>
          <button
            className="button"
            disabled={!matches.length}
            onClick={() => {
              if (!editor) return;
              const done = replaceAll(editor, replacement);
              app.notify(`Replaced ${done} ${done === 1 ? "match" : "matches"}`);
            }}
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
