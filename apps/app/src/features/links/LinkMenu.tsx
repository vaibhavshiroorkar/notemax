import type { Ref } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import type { LinkMenuItem } from "./link-hub";

/** The list that opens after typing [[. */
export function LinkMenu({
  ref,
  items,
  command,
  query,
}: SuggestionProps<LinkMenuItem, LinkMenuItem> & { ref?: Ref<SuggestionListHandle> }) {
  return (
    <SuggestionList
      ref={ref}
      items={items}
      command={command}
      label="Link to a note"
      className="link-menu"
      empty={query ? "No matches" : "Type a title to link a note"}
      itemKey={(item) => (item.kind === "existing" ? item.node.id : "create")}
      renderItem={(item) =>
        item.kind === "existing" ? (
          <>
            <span className="suggest-title">{item.node.title || "Untitled"}</span>
            <span className="suggest-detail">{item.where}</span>
          </>
        ) : (
          <span className="suggest-title">
            Create note <strong>{item.title}</strong>
          </span>
        )
      }
    />
  );
}
