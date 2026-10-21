import type { Ref } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import { useOption } from "@/plugins/options";
import type { SlashItem } from "@/plugins/types";
import "./slash.css";

/** The list that opens after typing /. */
export function SlashMenu({ ref, items, command }: SuggestionProps<SlashItem, SlashItem> & { ref?: Ref<SuggestionListHandle> }) {
  const hints = useOption("slash", "hints");
  return (
    <SuggestionList
      ref={ref}
      items={items}
      command={command}
      label="Insert a block"
      className="slash-menu"
      empty="No matches"
      itemKey={(item) => item.title}
      renderItem={(item) => (
        <>
          <span className="suggest-title">{item.title}</span>
          {hints && item.hint && <kbd className="slash-hint">{item.hint}</kbd>}
        </>
      )}
    />
  );
}
