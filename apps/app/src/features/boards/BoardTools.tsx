import { useEffect, useRef, useState } from "react";
import { STICKY_COLORS, TEMPLATES, addFrame, addSticky, clearVotes, vote } from "./miro";

type Api = Parameters<typeof addSticky>[0];

/** The board's own tools, top right: sticky notes, frames, templates and votes. */
export function BoardTools({ api }: { api: () => Api | null }) {
  const [open, setOpen] = useState<"sticky" | "templates" | null>(null);
  const [said, setSaid] = useState("");
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !wrapper.current?.contains(event.target as Node) && setOpen(null);
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  useEffect(() => {
    if (!said) return;
    const timer = setTimeout(() => setSaid(""), 2500);
    return () => clearTimeout(timer);
  }, [said]);

  const run = (action: (board: Api) => void) => {
    const board = api();
    if (board) action(board);
    setOpen(null);
  };

  return (
    <div className="board-tools" ref={wrapper}>
      <div className="board-tool-wrap">
        <button className="board-tool" aria-haspopup="menu" aria-expanded={open === "sticky"} onClick={() => setOpen(open === "sticky" ? null : "sticky")}>
          <span className="board-sticky-swatch" style={{ background: STICKY_COLORS[0].value }} />
          Sticky
        </button>
        {open === "sticky" && (
          <div className="board-menu" role="menu" aria-label="Sticky note color">
            {STICKY_COLORS.map((color) => (
              <button key={color.name} role="menuitem" className="board-color" aria-label={`${color.name} sticky note`} title={color.name} style={{ background: color.value }} onClick={() => run((board) => addSticky(board, color.value))} />
            ))}
          </div>
        )}
      </div>
      <button className="board-tool" onClick={() => run(addFrame)}>
        Frame
      </button>
      <div className="board-tool-wrap">
        <button className="board-tool" aria-haspopup="menu" aria-expanded={open === "templates"} onClick={() => setOpen(open === "templates" ? null : "templates")}>
          Templates
        </button>
        {open === "templates" && (
          <div className="board-menu board-templates" role="menu" aria-label="Templates">
            {TEMPLATES.map((template) => (
              <button key={template.name} role="menuitem" className="board-template" onClick={() => run(template.place)}>
                <strong>{template.name}</strong>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        className="board-tool"
        title="Add a vote to each selected shape"
        onClick={() =>
          run((board) => {
            const n = vote(board);
            setSaid(n ? `Voted on ${n === 1 ? "1 shape" : `${n} shapes`}` : "Select stickies or shapes first");
          })
        }
      >
        Vote
      </button>
      <button
        className="board-tool"
        title="Take every vote off the board"
        onClick={() =>
          run((board) => {
            const n = clearVotes(board);
            setSaid(n ? "Votes cleared" : "No votes yet");
          })
        }
      >
        Clear votes
      </button>
      {said && (
        <span className="board-said" role="status">
          {said}
        </span>
      )}
    </div>
  );
}
