import { Fragment, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import "./suggestion.css";

export interface SuggestionListHandle {
  onKeyDown(event: KeyboardEvent): boolean;
}

/**
 * The list that pops up under the cursor for [[, / and any later trigger.
 * Arrows move, Enter or Tab picks. Esc is handled by the suggestion plugin.
 */
export function SuggestionList<T>({
  ref,
  items,
  command,
  label,
  className,
  empty,
  itemKey,
  renderItem,
  groupOf,
}: {
  ref?: Ref<SuggestionListHandle>;
  items: T[];
  command(item: T): void;
  label: string;
  className?: string;
  empty: ReactNode;
  itemKey(item: T): string;
  renderItem(item: T): ReactNode;
  /** A heading above the first item of each group, like "Lists". */
  groupOf?(item: T): string;
}) {
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => setIndex(0), [items]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      // With no items, Enter must still reach the editor and start a new line.
      if (!items.length) return false;
      if (event.key === "ArrowDown") setIndex((i) => (i + 1) % items.length);
      else if (event.key === "ArrowUp") setIndex((i) => (i - 1 + items.length) % items.length);
      else if (event.key === "Enter" || event.key === "Tab") command(items[index]);
      else return false;
      return true;
    },
  }));

  return (
    <div ref={list} className={`suggest-menu ${className ?? ""}`} role="listbox" aria-label={label}>
      {items.length === 0 && <div className="suggest-empty">{empty}</div>}
      {items.map((item, i) => {
        const group = groupOf?.(item);
        return (
          <Fragment key={itemKey(item)}>
            {group && group !== (i > 0 ? groupOf!(items[i - 1]) : undefined) && (
              <div className="suggest-group" role="presentation">
                {group}
              </div>
            )}
            <button
              role="option"
              aria-selected={i === index}
              className="suggest-item"
              // Keep focus in the editor, so the suggestion stays open until the click lands.
              onMouseDown={(event) => event.preventDefault()}
              // Move, not enter: arrow keys scroll the list under a still pointer, which must not take the choice back.
              onMouseMove={() => i !== index && setIndex(i)}
              onClick={() => command(item)}
            >
              {renderItem(item)}
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}
