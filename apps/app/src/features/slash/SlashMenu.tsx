import type { Ref } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import { useOption } from "@/plugins/options";
import type { SlashItem } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import "./slash.css";

/** The list that opens after typing /. Grouped while nothing is typed, best match first after. */
export function SlashMenu({ ref, items, command, query }: SuggestionProps<SlashItem, SlashItem> & { ref?: Ref<SuggestionListHandle> }) {
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
      groupOf={query.trim() ? undefined : (item) => item.group ?? "More"}
      renderItem={(item) => (
        <>
          <span className="slash-icon">
            <Icon name={item.icon ?? "plus"} />
          </span>
          <span className="slash-text">
            <span className="suggest-title">{item.title}</span>
            {item.description && <span className="slash-description">{item.description}</span>}
          </span>
          {hints && item.hint && <kbd className="slash-hint">{item.hint}</kbd>}
        </>
      )}
    />
  );
}
