import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface Match {
  from: number;
  to: number;
}

interface FindState {
  query: string;
  matchCase: boolean;
  matches: Match[];
  current: number;
  decorations: DecorationSet;
}

type FindMeta = { query: string; matchCase: boolean } | { current: number };

const key = new PluginKey<FindState>("find");

/**
 * Every place the words appear. Each text block is read as one string, with a
 * stand-in character for a link chip or other inline node, so an index in the
 * string plus the block's start is a position in the document.
 */
export function findAll(doc: PMNode, query: string, matchCase: boolean): Match[] {
  if (!query) return [];
  const needle = matchCase ? query : query.toLowerCase();
  const out: Match[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    node.forEach((child) => (text += child.isText ? child.text! : "\u0001".repeat(child.nodeSize)));
    const hay = matchCase ? text : text.toLowerCase();
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
      out.push({ from: pos + 1 + at, to: pos + 1 + at + needle.length });
    }
    return false;
  });
  return out;
}

function decorate(doc: PMNode, matches: Match[], current: number) {
  return DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? "find-match find-current" : "find-match" })),
  );
}

const EMPTY: FindState = { query: "", matchCase: false, matches: [], current: -1, decorations: DecorationSet.empty };

/** Lights up every match of the find bar's words in a note, and the one it is on more. */
export const FindHighlight = Extension.create({
  name: "find",
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key,
        state: {
          init: () => EMPTY,
          apply(tr, old) {
            const meta = tr.getMeta(key) as FindMeta | undefined;
            if (meta && "query" in meta) {
              const matches = findAll(tr.doc, meta.query, meta.matchCase);
              const current = matches.length ? 0 : -1;
              return { ...meta, matches, current, decorations: decorate(tr.doc, matches, current) };
            }
            if (meta && "current" in meta) return { ...old, current: meta.current, decorations: decorate(tr.doc, old.matches, meta.current) };
            if (!tr.docChanged || !old.query) return old;
            // Typing moves the matches, so look again, staying near the one it was on.
            const matches = findAll(tr.doc, old.query, old.matchCase);
            const current = matches.length ? Math.min(Math.max(old.current, 0), matches.length - 1) : -1;
            return { ...old, matches, current, decorations: decorate(tr.doc, matches, current) };
          },
        },
        props: { decorations: (state) => key.getState(state)?.decorations },
      }),
    ];
  },
});

export const findState = (editor: Editor): FindState => key.getState(editor.state) ?? EMPTY;

export function setQuery(editor: Editor, query: string, matchCase: boolean) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(key, { query, matchCase }));
}

/** Moves to the next match (1) or the one before (-1), selects it and scrolls to it. */
export function step(editor: Editor, by: 1 | -1 | 0) {
  const { matches, current } = findState(editor);
  if (!matches.length) return;
  const next = (current + by + matches.length) % matches.length;
  const { from, to } = matches[next];
  editor.view.dispatch(editor.state.tr.setMeta(key, { current: next }).setSelection(TextSelection.create(editor.state.doc, from, to)).scrollIntoView());
}

export function replaceCurrent(editor: Editor, text: string) {
  const { matches, current } = findState(editor);
  const match = matches[current];
  if (!match) return;
  editor.view.dispatch(editor.state.tr.insertText(text, match.from, match.to));
  step(editor, 0);
}

/** Replaces every match in one step, so one Undo puts them all back. */
export function replaceAll(editor: Editor, text: string): number {
  const { matches } = findState(editor);
  if (!matches.length) return 0;
  const tr = editor.state.tr;
  for (const match of [...matches].reverse()) tr.insertText(text, match.from, match.to);
  editor.view.dispatch(tr);
  return matches.length;
}
