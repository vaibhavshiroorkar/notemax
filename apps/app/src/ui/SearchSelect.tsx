import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./Icon";
import "./search-select.css";

export interface Choice {
  value: string;
  label: string;
  /** Small text on the right, like "on this device". */
  hint?: string;
  style?: CSSProperties;
}

/**
 * A dropdown with a search box, for lists too long to scroll by eye, like
 * fonts. Arrows move, Enter picks, Esc closes. `extra` adds choices made from
 * what was typed, like "Use the font named ...".
 */
export function SearchSelect({
  label,
  value,
  shown,
  choices,
  onChange,
  extra,
  footer,
}: {
  label: string;
  value: string;
  /** What the closed dropdown says. */
  shown: { label: string; style?: CSSProperties };
  choices: Choice[];
  onChange(value: string): void;
  extra?(query: string): Choice[];
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? choices.filter((c) => c.label.toLowerCase().includes(q)) : choices;
    return [...matching, ...(q && extra ? extra(query.trim()) : [])];
  }, [choices, query, extra]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !wrapper.current?.contains(event.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const pick = (choice: Choice | undefined) => {
    if (!choice) return;
    onChange(choice.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="search-select" ref={wrapper}>
      <button className="search-select-button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${shown.label}`} onClick={() => setOpen(!open)}>
        <span style={shown.style}>{shown.label}</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div className="search-select-popup">
          <input
            className="search-select-input"
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") setIndex((i) => Math.min(found.length - 1, i + 1));
              else if (event.key === "ArrowUp") setIndex((i) => Math.max(0, i - 1));
              else if (event.key === "Enter") pick(found[index]);
              else if (event.key === "Escape") setOpen(false);
              else return;
              event.preventDefault();
              event.stopPropagation();
            }}
          />
          <div className="search-select-list" role="listbox" aria-label={label} ref={list}>
            {found.length === 0 && <p className="search-select-empty">No matches</p>}
            {found.map((choice, i) => (
              <button
                key={choice.value}
                role="option"
                aria-selected={i === index}
                data-current={choice.value === value || undefined}
                className="search-select-option"
                onMouseMove={() => i !== index && setIndex(i)}
                onClick={() => pick(choice)}
              >
                <span style={choice.style}>{choice.label}</span>
                {choice.hint && <span className="search-select-hint">{choice.hint}</span>}
              </button>
            ))}
          </div>
          {/* A footer action, like loading a file, is a choice too: the list closes. */}
          {footer && (
            <div className="search-select-footer" onClick={() => setOpen(false)}>
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
