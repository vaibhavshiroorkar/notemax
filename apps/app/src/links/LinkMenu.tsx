import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { LinkMenuItem } from "./link-hub";

export interface LinkMenuHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

/** The list that opens after typing [[. Arrows move, Enter or Tab picks, Esc closes. */
export const LinkMenu = forwardRef<LinkMenuHandle, SuggestionProps<LinkMenuItem, LinkMenuItem>>(function LinkMenu(
  { items, command, query },
  ref,
) {
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (!items.length) return false;
      if (event.key === "ArrowDown") setIndex((i) => (i + 1) % items.length);
      else if (event.key === "ArrowUp") setIndex((i) => (i - 1 + items.length) % items.length);
      else if (event.key === "Enter" || event.key === "Tab") command(items[index]);
      else return false;
      return true;
    },
  }));

  return (
    <div className="link-menu" role="listbox" aria-label="Link to a note">
      {items.length === 0 && <div className="link-menu-empty">{query ? "No matches" : "Type a title to link a note"}</div>}
      {items.map((item, i) => (
        <button
          key={item.kind === "existing" ? item.node.id : "create"}
          role="option"
          aria-selected={i === index}
          className="link-menu-item"
          // Keep focus in the editor, so the suggestion stays open until the click lands.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setIndex(i)}
          onClick={() => command(item)}
        >
          {item.kind === "existing" ? (
            <>
              <span className="link-menu-title">{item.node.title || "Untitled"}</span>
              <span className="link-menu-where">{item.where}</span>
            </>
          ) : (
            <span className="link-menu-title">
              Create note <strong>{item.title}</strong>
            </span>
          )}
        </button>
      ))}
    </div>
  );
});
