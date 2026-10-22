import { Extension, wrappingInputRule, type CommandProps } from "@tiptap/core";

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

/** "1) " starts a numbered list, as "1. " does. It starts at the number typed. */
export const ParenthesisList = Extension.create({
  name: "parenthesisList",
  addInputRules() {
    const type = this.editor.schema.nodes.orderedList;
    if (!type) return [];
    return [
      wrappingInputRule({
        find: /^(\d+)\)\s$/,
        type,
        getAttributes: (match) => ({ start: Number(match[1]) }),
        joinPredicate: (match, node) => node.childCount + node.attrs.start === Number(match[1]),
      }),
    ];
  },
});
