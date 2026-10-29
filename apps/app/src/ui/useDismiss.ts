import { useEffect, useRef, type RefObject } from "react";

/** What counts as inside a popup: its box, a part drawn elsewhere, or a selector, like the button that opens it. */
export type Inside = RefObject<Element | null> | string;

/**
 * Closes a popup on a press outside it or on Esc, like any menu. Esc is left
 * to a dialog open on top, like a confirm the popup asked, so it closes first.
 */
export function useDismiss(open: boolean, close: () => void, ...inside: Inside[]) {
  const latest = useRef({ close, inside });
  latest.current = { close, inside };
  useEffect(() => {
    if (!open) return;
    const isInside = (target: EventTarget | null) =>
      target instanceof Node &&
      latest.current.inside.some((part) => (typeof part === "string" ? target instanceof Element && !!target.closest(part) : part.current?.contains(target)));
    const onPointer = (event: PointerEvent) => !isInside(event.target) && latest.current.close();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !document.querySelector("dialog[open]") && latest.current.close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
}
