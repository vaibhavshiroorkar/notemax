import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { SlashItem } from "./slash-items";

export interface SlashMenuHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

/** The list that opens after typing /. Arrows move, Enter or Tab picks, Esc closes. */
export const SlashMenu = forwardRef<SlashMenuHandle, SuggestionProps<SlashItem, SlashItem>>(function SlashMenu(
  { items, command },
  ref,
) {
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      // With no matches, Enter must still start a new line.
      if (!items.length) return false;
      if (event.key === "ArrowDown") setIndex((i) => (i + 1) % items.length);
      else if (event.key === "ArrowUp") setIndex((i) => (i - 1 + items.length) % items.length);
      else if (event.key === "Enter" || event.key === "Tab") command(items[index]);
      else return false;
      return true;
    },
  }));

  return (
    <div ref={list} className="link-menu slash-menu" role="listbox" aria-label="Insert a block">
      {items.length === 0 && <div className="link-menu-empty">No matches</div>}
      {items.map((item, i) => (
        <button
          key={item.title}
          role="option"
          aria-selected={i === index}
          className="link-menu-item"
          // Keep focus in the editor, so the suggestion stays open until the click lands.
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => setIndex(i)}
          onClick={() => command(item)}
        >
          <span className="link-menu-title">{item.title}</span>
          {item.hint && <kbd className="slash-hint">{item.hint}</kbd>}
        </button>
      ))}
    </div>
  );
});
