import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { registry } from "@/plugins/registry";
import type { SlashItem } from "@/plugins/types";
import { renderPopup } from "@/ui/suggestion/render-popup";
import { SlashMenu } from "./SlashMenu";
import { filterSlashItems } from "./slash-items";

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
        items: ({ query }) => filterSlashItems(registry.slashItems(), query),
        command: ({ editor, range, props: item }) => {
          item.apply(editor.chain().focus().deleteRange(range)).run();
        },
        render: renderPopup(SlashMenu),
      }),
    ];
  },
});
