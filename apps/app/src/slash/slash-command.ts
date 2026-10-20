import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";
import { filterSlashItems, type SlashItem } from "./slash-items";

const suggestionKey = new PluginKey("slashCommand");

/** Typing / at the start of a line or after a space opens a menu of block types. */
export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        pluginKey: suggestionKey,
        char: "/",
        // In a code block, / is just a character.
        allow: ({ state }) => !state.selection.$from.parent.type.spec.code,
        items: ({ query }) => filterSlashItems(query),
        command: ({ editor, range, props: item }) => {
          item.apply(editor.chain().focus().deleteRange(range)).run();
        },
        render: () => {
          let menu: ReactRenderer<SlashMenuHandle> | undefined;
          let unmount: (() => void) | undefined;
          return {
            onStart(props) {
              menu = new ReactRenderer(SlashMenu, { props, editor: props.editor });
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
