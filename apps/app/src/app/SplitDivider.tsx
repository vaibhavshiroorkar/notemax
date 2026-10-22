import type { PointerEvent } from "react";
import { resizeSplit } from "./tabs";

// A pane is never squeezed below this share of the pair it is resized against.
const SMALLEST = 0.15;

/** The line between two panes of a split. Dragging it gives one more room and the other less. */
export function SplitDivider({ path, index, dir, sizes }: { path: number[]; index: number; dir: "row" | "column"; sizes: number[] }) {
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const line = event.currentTarget;
    const before = line.previousElementSibling as HTMLElement | null;
    const after = line.nextElementSibling as HTMLElement | null;
    if (!before || !after) return;
    event.preventDefault();
    line.setPointerCapture(event.pointerId);
    const row = dir === "row";
    const start = row ? event.clientX : event.clientY;
    const a = row ? before.offsetWidth : before.offsetHeight;
    const b = row ? after.offsetWidth : after.offsetHeight;
    const pair = sizes[index - 1] + sizes[index];
    const move = (e: globalThis.PointerEvent) => {
      const shift = (row ? e.clientX : e.clientY) - start;
      const share = Math.min(1 - SMALLEST, Math.max(SMALLEST, (a + shift) / (a + b)));
      const next = [...sizes];
      next[index - 1] = pair * share;
      next[index] = pair * (1 - share);
      resizeSplit(path, next);
    };
    const up = () => {
      line.removeEventListener("pointermove", move);
      line.removeEventListener("pointerup", up);
    };
    line.addEventListener("pointermove", move);
    line.addEventListener("pointerup", up);
  };
  return <div className="split-divider" data-dir={dir} role="separator" aria-orientation={dir === "row" ? "vertical" : "horizontal"} aria-label="Resize panes" onPointerDown={onPointerDown} />;
}
