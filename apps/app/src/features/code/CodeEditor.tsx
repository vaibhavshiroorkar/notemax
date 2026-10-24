import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, foldKeymap, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import { infoOf, type Language } from "./languages";

// Colors come from the theme, so code reads well in light and dark alike.
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword, tags.operatorKeyword], color: "var(--code-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--code-string)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--code-number)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--muted)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--code-function)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--code-type)" },
  { tag: [tags.definition(tags.variableName)], color: "var(--text)" },
  { tag: [tags.processingInstruction, tags.meta], color: "var(--code-keyword)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "var(--code-bg)", fontSize: "14px" },
  ".cm-content": { fontFamily: "Consolas, 'Cascadia Code', monospace", caretColor: "var(--text)", padding: "10px 0" },
  ".cm-gutters": { backgroundColor: "var(--code-bg)", color: "var(--muted)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--hover)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--selection, rgba(100, 140, 255, 0.3))" },
  ".cm-cursor": { borderLeftColor: "var(--text)" },
  "&.cm-focused": { outline: "none" },
  ".cm-placeholder": { color: "var(--muted)" },
  ".cm-panels": { backgroundColor: "var(--bg)", color: "var(--text)" },
});

/**
 * The code itself, in CodeMirror. It writes straight into the page's shared
 * text, so typing syncs and merges like a note, with an undo of its own.
 */
export function CodeEditor({ text, language, onRun, onReady }: { text: Y.Text; language: Language; onRun(): void; onReady?(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const languages = useRef(new Compartment());
  const hint = useRef(new Compartment());
  const run = useRef(onRun);
  run.current = onRun;

  useEffect(() => {
    const state = EditorState.create({
      doc: text.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        search({ top: true }),
        indentUnit.of("    "),
        EditorState.tabSize.of(4),
        syntaxHighlighting(highlight),
        theme,
        languages.current.of([]),
        hint.current.of(placeholder(infoOf(language).placeholder)),
        keymap.of([{ key: "Mod-Enter", run: () => (run.current(), true) }, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...foldKeymap, ...yUndoManagerKeymap, indentWithTab]),
        yCollab(text, null),
        EditorView.contentAttributes.of({ "aria-label": "Code", spellcheck: "false" }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current! });
    onReady?.();
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // The editor is made once per shared text; the language changes in place below.
  }, [text]);

  useEffect(() => {
    let live = true;
    void infoOf(language)
      .load()
      .then((support) => {
        if (live && view.current) view.current.dispatch({ effects: [languages.current.reconfigure(support), hint.current.reconfigure(placeholder(infoOf(language).placeholder))] });
      });
    return () => {
      live = false;
    };
  }, [language, text]);

  return <div ref={host} className="code-editor" />;
}
