import { useRef } from "react";
import type { Store } from "@/platform/store";
import type { PaneSize } from "./layout";
import "./resize-handle.css";

interface Props {
  /** Which edge of the window the pane sits on. */
  side: "left" | "right";
  label: string;
  size: PaneSize;
  width: Store<number>;
  /** The CSS variable on the parent element that sets the pane's width. */
  cssVar: string;
  /** Called when the pane is dragged well past its smallest width. */
  onCollapse(): void;
}

const STEP = 16;

/**
 * The edge of a sidebar. Drag to resize, double-click to go back to the default
 * width, or focus it and use the arrow keys.
 */
export function ResizeHandle({ side, label, size, width, cssVar, onCollapse }: Props) {
  const drag = useRef<{ startX: number; startWidth: number; raw: number; frame: number } | null>(null);
  const current = width.use();

  // The page never gets squeezed below about half the window.
  const clamp = (value: number) => Math.round(Math.min(size.max, window.innerWidth * 0.45, Math.max(size.min, value)));

  // While dragging, the width goes straight onto the CSS variable once per frame.
  // React and prefs only hear about the final width, so a drag never re-renders the app.
  const show = (element: HTMLElement, value: number) => element.parentElement?.style.setProperty(cssVar, `${value}px`);

  const finish = (element: HTMLElement) => {
    const state = drag.current;
    if (!state) return;
    drag.current = null;
    cancelAnimationFrame(state.frame);
    delete element.dataset.dragging;
    document.documentElement.classList.remove("resizing");
    if (state.raw < size.min / 2) {
      show(element, state.startWidth);
      return onCollapse();
    }
    const next = clamp(state.raw);
    show(element, next);
    if (next !== state.startWidth) width.set(next);
  };

  return (
    <div
      className="resize-handle"
      data-side={side}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={current}
      aria-valuemin={size.min}
      aria-valuemax={size.max}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { startX: event.clientX, startWidth: width.get(), raw: width.get(), frame: 0 };
        event.currentTarget.dataset.dragging = "";
        document.documentElement.classList.add("resizing");
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state) return;
        const moved = event.clientX - state.startX;
        state.raw = state.startWidth + (side === "left" ? moved : -moved);
        const element = event.currentTarget;
        cancelAnimationFrame(state.frame);
        state.frame = requestAnimationFrame(() => show(element, clamp(state.raw)));
      }}
      onPointerUp={(event) => finish(event.currentTarget)}
      onLostPointerCapture={(event) => finish(event.currentTarget)}
      onDoubleClick={() => width.set(size.default)}
      onKeyDown={(event) => {
        const grow = side === "left" ? "ArrowRight" : "ArrowLeft";
        const shrink = side === "left" ? "ArrowLeft" : "ArrowRight";
        if (event.key === grow) width.set(clamp(current + STEP));
        else if (event.key === shrink) width.set(clamp(current - STEP));
        else if (event.key === "Enter") width.set(size.default);
        else return;
        event.preventDefault();
      }}
    />
  );
}
