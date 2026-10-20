import type { Ref } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import type { SlashItem } from "./slash-items";
import "./slash.css";

/** The list that opens after typing /. */
export function SlashMenu({ ref, items, command }: SuggestionProps<SlashItem, SlashItem> & { ref?: Ref<SuggestionListHandle> }) {
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
          {item.hint && <kbd className="slash-hint">{item.hint}</kbd>}
        </>
      )}
    />
  );
}
