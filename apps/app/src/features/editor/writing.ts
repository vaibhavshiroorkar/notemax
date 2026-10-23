import { Extension, wrappingInputRule, type CommandProps } from "@tiptap/core";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";

/** How many steps a paragraph can be pushed in. */
const MAX_INDENT = 8;
const INDENTED = ["paragraph", "heading"];
const LIST_ITEMS = ["listItem", "taskItem"];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /** Pushes the paragraphs in the selection one step to the right. */
      indent: () => ReturnType;
      /** Pulls them one step back. */
      outdent: () => ReturnType;
    };
  }
}

/**
 * Tab and Shift+Tab, like in a word processor: in a list they nest and un-nest
 * the item, in a paragraph or heading they indent it, and in a code block Tab
 * types a tab. Tab never leaves the note.
 */
export const Indent = Extension.create({
  name: "indent",
  // After the list items, so their own Tab (nest the item) goes first.
  priority: 50,

  addGlobalAttributes() {
    return [
      {
        types: INDENTED,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute("data-indent")) || 0),
            renderHTML: (attrs) => (attrs.indent ? { "data-indent": attrs.indent, style: `margin-left: ${attrs.indent * 1.5}em` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    const step =
      (by: 1 | -1) =>
      () =>
      ({ tr, state, dispatch }: CommandProps) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (!INDENTED.includes(node.type.name)) return;
          const next = Math.max(0, Math.min(MAX_INDENT, (node.attrs.indent ?? 0) + by));
          if (next === node.attrs.indent) return false;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
          return false;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return { indent: step(1), outdent: step(-1) };
  },

  addKeyboardShortcuts() {
    const inside = (names: string[]) => {
      const { $from } = this.editor.state.selection;
      for (let depth = $from.depth; depth > 0; depth--) if (names.includes($from.node(depth).type.name)) return true;
      return false;
    };
    return {
      Tab: () => {
        if (inside(["codeBlock"])) return this.editor.commands.insertContent("\t");
        // A list item that cannot nest further, like the first one: Tab still stays in the note.
        if (inside(LIST_ITEMS)) return true;
        this.editor.commands.indent();
        return true;
      },
      "Shift-Tab": () => {
        if (inside(LIST_ITEMS) || inside(["codeBlock"])) return true;
        this.editor.commands.outdent();
        return true;
      },
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineSpacing: {
      /** Line spacing of the paragraphs in the selection, like "1.8". Null goes back to the default. */
      setLineSpacing: (value: string | null) => ReturnType;
    };
  }
}

/** Line spacing per paragraph or heading, as in Word, rather than per run of text. */
export const LineSpacing = Extension.create({
  name: "lineSpacing",

  addGlobalAttributes() {
    return [
      {
        types: INDENTED,
        attributes: {
          lineSpacing: {
            default: null,
            parseHTML: (el) => {
              // Word writes "line-height:150%" or a plain number.
              const raw = el.style.lineHeight;
              if (!raw || raw === "normal") return null;
              return raw.endsWith("%") ? String(parseFloat(raw) / 100) : /^[\d.]+$/.test(raw) ? raw : null;
            },
            renderHTML: (attrs) => (attrs.lineSpacing ? { style: `line-height: ${attrs.lineSpacing}` } : {}),
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineSpacing:
        (value) =>
        ({ tr, state, dispatch }: CommandProps) => {
          const { from, to } = state.selection;
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!INDENTED.includes(node.type.name)) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineSpacing: value });
            return false;
          });
          dispatch?.(tr);
          return true;
        },
    };
  },
});

/**
 * How a numbered list writes its numbers: "1." or, for a list started with
 * "1) ", "1)". Part of the note's content, so the choice syncs and exports.
 */
export const ListMarker = Extension.create({
  name: "listMarker",
  addGlobalAttributes() {
    return [
      {
        types: ["orderedList"],
        attributes: {
          marker: {
            default: null,
            parseHTML: (el) => (el.getAttribute("data-marker") === ")" ? ")" : null),
            renderHTML: (attrs) => (attrs.marker === ")" ? { "data-marker": ")" } : {}),
          },
        },
      },
    ];
  },
});

/** "1) " starts a numbered list that keeps the parenthesis, at the number typed. */
export const ParenthesisList = Extension.create({
  name: "parenthesisList",
  addInputRules() {
    const type = this.editor.schema.nodes.orderedList;
    if (!type) return [];
    return [
      wrappingInputRule({
        find: /^(\d+)\)\s$/,
        type,
        getAttributes: (match) => ({ start: Number(match[1]), marker: ")" }),
        joinPredicate: (match, node) => node.attrs.marker === ")" && node.childCount + node.attrs.start === Number(match[1]),
      }),
    ];
  },
});

/** What a typing shortcut changed, as the editor's own input rules record it. */
interface Undoable {
  transform: Transaction;
  from: number;
  to: number;
  text: string;
}

const isUndoable = (value: unknown): value is Undoable => !!value && typeof value === "object" && "transform" in value && "from" in value && "to" in value && "text" in value;
const lastShortcut = new PluginKey<Undoable | null>("lastShortcut");

/**
 * Backspace right after a typing shortcut (a list, a heading, bold) gives back
 * exactly what was typed. The editor can do this itself, but forgets the
 * shortcut as soon as another plugin follows it up, like the empty line added
 * after a list at the end of a note. This remembers it through such follow-ups.
 */
export const ShortcutUndo = Extension.create({
  name: "shortcutUndo",
  // Before every other Backspace, like the one that lifts a list item out.
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin<Undoable | null>({
        key: lastShortcut,
        state: {
          init: () => null,
          apply(tr, previous) {
            // The input rule plugin keeps the change in its meta under a key of its own.
            if (tr.getMeta("inputRule")) return Object.values((tr as unknown as { meta: Record<string, unknown> }).meta).find(isUndoable) ?? null;
            if (tr.getMeta("appendedTransaction")) return previous;
            return tr.docChanged || tr.selectionSet ? null : previous;
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const undoable = lastShortcut.getState(editor.state);
        if (!undoable) return false;
        const { state, view } = editor;
        const tr = state.tr;
        const steps = undoable.transform.steps;
        try {
          for (let i = steps.length - 1; i >= 0; i--) tr.step(steps[i].invert(undoable.transform.docs[i]));
          if (undoable.text) tr.replaceWith(undoable.from, undoable.to, state.schema.text(undoable.text, tr.doc.resolve(undoable.from).marks()));
          else tr.delete(undoable.from, undoable.to);
        } catch {
          // The note changed in a way the steps no longer fit; let Backspace do its usual job.
          return false;
        }
        view.dispatch(tr);
        return true;
      },
    };
  },
});
