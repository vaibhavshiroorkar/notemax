import { Node, mergeAttributes } from "@tiptap/core";
import { NodeSelection, PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { WIKI_LINK } from "@notemax/core";
import { LinkMenu, type LinkMenuHandle } from "./LinkMenu";
import type { LinkHub, LinkMenuItem } from "./link-hub";

export interface WikiLinkOptions {
  hub: LinkHub;
  /** The note being edited, left out of the menu so it cannot link to itself. */
  currentId: string;
}

const suggestionKey = new PluginKey("wikiLinkSuggestion");

/**
 * A link to another note, stored by id. It always shows the target's current
 * title, so renaming a note never breaks or dates the links to it. `label`
 * keeps the title from when the link was made, for when the target is gone.
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: WIKI_LINK,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { hub: undefined as unknown as LinkHub, currentId: "" };
  },

  addAttributes() {
    return {
      targetId: { default: null, parseHTML: (el) => el.getAttribute("data-target") },
      label: { default: "", parseHTML: (el) => el.textContent ?? "" },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-link]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, { "data-wiki-link": "", "data-target": node.attrs.targetId, class: "wiki-link" }),
      node.attrs.label,
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.label}]]`;
  },

  addNodeView() {
    const hub = this.options.hub;
    return ({ node: initial }) => {
      let node = initial;
      const dom = document.createElement("a");
      dom.className = "wiki-link";
      dom.setAttribute("data-wiki-link", "");
      const render = () => {
        const target = hub.lookup(node.attrs.targetId);
        const openable = hub.isOpenable(node.attrs.targetId);
        dom.textContent = target?.title || node.attrs.label || "Untitled";
        dom.classList.toggle("wiki-link-missing", !openable);
        dom.title = openable
          ? "Open note (click, or Ctrl+Enter when selected)"
          : target
            ? "This note is in the Trash"
            : "This note no longer exists";
      };
      render();
      const unsubscribe = hub.subscribe(render);
      dom.addEventListener("click", (event) => {
        event.preventDefault();
        hub.open(node.attrs.targetId);
      });
      return {
        dom,
        update(next) {
          if (next.type !== node.type) return false;
          node = next;
          render();
          return true;
        },
        // The text inside comes from the title, not the document, so ProseMirror must not read it back.
        ignoreMutation: () => true,
        destroy: unsubscribe,
      };
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== WIKI_LINK) return false;
        this.options.hub.open(selection.node.attrs.targetId);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const { hub, currentId } = this.options;
    return [
      Suggestion<LinkMenuItem, LinkMenuItem>({
        editor: this.editor,
        pluginKey: suggestionKey,
        char: "[[",
        // Titles have spaces in them.
        allowSpaces: true,
        // Typing ]] means plain brackets were meant. A very long query means the writer kept writing.
        allow: ({ state, range }) => {
          const query = state.doc.textBetween(range.from, range.to);
          return !query.includes("]]") && query.length <= 120;
        },
        items: ({ query }) => hub.menuItems(query, currentId),
        command: ({ editor, range, props: item }) => {
          const targetId = item.kind === "create" ? hub.create(item.title) : item.node.id;
          const label = item.kind === "create" ? item.title : item.node.title;
          editor
            .chain()
            .focus()
            .insertContentAt(range, [
              { type: WIKI_LINK, attrs: { targetId, label } },
              { type: "text", text: " " },
            ])
            .run();
        },
        render: () => {
          let menu: ReactRenderer<LinkMenuHandle> | undefined;
          let unmount: (() => void) | undefined;
          return {
            onStart(props) {
              menu = new ReactRenderer(LinkMenu, { props, editor: props.editor });
              unmount = props.mount(menu.element as HTMLElement);
            },
            onUpdate(props) {
              menu?.updateProps(props);
            },
            onKeyDown({ event }) {
              return menu?.ref?.onKeyDown(event) ?? false;
            },
            onExit() {
              unmount?.();
              menu?.destroy();
              menu = undefined;
            },
          };
        },
      }),
    ];
  },
});
