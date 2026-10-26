import { useState, type CSSProperties, type DragEvent } from "react";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { BOX_FROM, filterSubtopics, type Subtopic } from "./subtopics";
import "./subtopics.css";

type Zone = "before" | "after" | "inside";

/**
 * A note's subtopics as a list to jump from. They are all on the note's own
 * page, so a click scrolls there. Past five they sit in a box of their own,
 * with a filter and a scroll, so a long list never pushes everything else away.
 *
 * With `onMove`, a subtopic drags onto another: its top part puts it before,
 * its bottom part after, and its middle inside, as a subtopic of that one.
 * Not while filtering, since the list then hides the neighbours a drop needs.
 */
export function SubtopicList({ list, onOpen, onMove, style }: { list: Subtopic[]; onOpen(id: string): void; onMove?(id: string, parentId: string, nextId: string | null): void; style?: CSSProperties }) {
  const [query, setQuery] = useState("");
  const [moving, setMoving] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; zone: Zone } | null>(null);
  const boxed = list.length >= BOX_FROM;
  const shown = boxed ? filterSubtopics(list, query) : list;
  const draggable = !!onMove && !query.trim();

  const zoneOf = (event: DragEvent<HTMLElement>): Zone => {
    const r = event.currentTarget.getBoundingClientRect();
    const at = (event.clientY - r.top) / r.height;
    return at < 0.3 ? "before" : at > 0.7 ? "after" : "inside";
  };
  const drop = (target: Subtopic, zone: Zone) => {
    if (!onMove || !moving || moving === target.item.id) return;
    if (zone === "inside") return onMove(moving, target.item.id, null);
    if (zone === "before") return onMove(moving, target.item.parentId, target.item.id);
    // After: before the next one beside it. The list runs in reading order, so
    // that is the next at the same depth, until the list climbs out of the parent.
    let next: string | null = null;
    for (const s of list.slice(list.indexOf(target) + 1)) {
      if (s.depth < target.depth) break;
      if (s.depth === target.depth && s.item.id !== moving) {
        next = s.item.id;
        break;
      }
    }
    onMove(moving, target.item.parentId, next);
  };
  const end = () => {
    setMoving(null);
    setOver(null);
  };
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
          <li key={item.id} data-drop={over?.id === item.id ? over.zone : undefined} data-moving={moving === item.id || undefined}>
            <button
              className="subtopic-link"
              style={{ "--depth": depth } as CSSProperties}
              onClick={() => onOpen(item.id)}
              onContextMenu={pageMenu(item)}
              draggable={draggable}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.title || "Untitled");
                setMoving(item.id);
              }}
              onDragOver={(event) => {
                if (!moving || moving === item.id) return;
                event.preventDefault();
                const zone = zoneOf(event);
                if (over?.id !== item.id || over.zone !== zone) setOver({ id: item.id, zone });
              }}
              onDragLeave={() => over?.id === item.id && setOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                drop(shown.find((s) => s.item.id === item.id)!, zoneOf(event));
                end();
              }}
              onDragEnd={end}
            >
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
