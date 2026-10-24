import { useState, type CSSProperties } from "react";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { BOX_FROM, filterSubtopics, type Subtopic } from "./subtopics";
import "./subtopics.css";

/**
 * A note's subtopics as a list to jump from. They are all on the note's own
 * page, so a click scrolls there. Past five they sit in a box of their own,
 * with a filter and a scroll, so a long list never pushes everything else away.
 */
export function SubtopicList({ list, onOpen, style }: { list: Subtopic[]; onOpen(id: string): void; style?: CSSProperties }) {
  const [query, setQuery] = useState("");
  const boxed = list.length >= BOX_FROM;
  const shown = boxed ? filterSubtopics(list, query) : list;
  return (
    <div className={boxed ? "subtopic-list subtopic-box" : "subtopic-list"} style={style}>
      {boxed && (
        <label className="subtopic-filter">
          <Icon name="search" />
          <input type="search" placeholder={`Filter ${list.length} subtopics`} aria-label="Filter subtopics" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
      )}
      <ul>
        {shown.map(({ item, label, depth }) => (
          <li key={item.id}>
            <button className="subtopic-link" style={{ "--depth": depth } as CSSProperties} onClick={() => onOpen(item.id)} onContextMenu={pageMenu(item)}>
              <span className="chapter-number">{label}</span>
              <span className="subtopic-title">{item.title || "Untitled"}</span>
            </button>
          </li>
        ))}
        {boxed && !shown.length && <li className="subtopic-none">No subtopic matches.</li>}
      </ul>
    </div>
  );
}
