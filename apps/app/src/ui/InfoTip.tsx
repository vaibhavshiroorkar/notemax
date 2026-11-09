import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { useDismiss } from "./useDismiss";
import "./info-tip.css";

const GAP = 6;
const EDGE = 8;

/** Under the button when it fits, above it when not, and never past the window's edges. */
function place(tip: HTMLElement, button: HTMLElement) {
  const at = button.getBoundingClientRect();
  const { width, height } = tip.getBoundingClientRect();
  const left = Math.min(Math.max(EDGE, at.left + at.width / 2 - 24), innerWidth - width - EDGE);
  const below = at.bottom + GAP;
  const top = below + height > innerHeight - EDGE && at.top - GAP - height > EDGE ? at.top - GAP - height : below;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

/**
 * A small (i) that holds an explanation, so a screen shows what to do and
 * keeps the why and how one tap away. A click or tap opens it until a press
 * elsewhere; on a screen with a mouse, pointing at it opens it too. The text
 * stays in the page while closed, so Settings search still finds it.
 */
export function InfoTip({ children, label = "More about this" }: { children: ReactNode; label?: string }) {
  // "point" closes when the mouse leaves; "press" stays until a press elsewhere.
  const [open, setOpen] = useState<false | "point" | "press">(false);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const id = useId();
  useDismiss(open === "press", () => setOpen(false), button, tip);

  useLayoutEffect(() => {
    const el = tip.current;
    if (!el || !button.current) return;
    if (!open) {
      if (el.matches?.(":popover-open")) el.hidePopover();
      return;
    }
    // In the top layer, so it shows over dialogs and is not cut off by a scrolling box.
    if (!el.matches?.(":popover-open")) el.showPopover?.();
    place(el, button.current);
  }, [open]);

  // It is placed once, so it goes when what it points at moves.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <span className="info-tip">
      <button
        ref={button}
        type="button"
        className="icon-button info-tip-button"
        aria-label={label}
        aria-expanded={!!open}
        aria-describedby={id}
        onClick={(event) => {
          // Inside a label, a click would also flip its switch.
          event.preventDefault();
          event.stopPropagation();
          setOpen((now) => (now === "press" ? false : "press"));
        }}
        onPointerEnter={(event) => event.pointerType === "mouse" && setOpen((now) => now || "point")}
        onPointerLeave={(event) => event.pointerType === "mouse" && setOpen((now) => (now === "point" ? false : now))}
        onKeyDown={(event) => {
          // Esc closes this first, not the dialog around it.
          if (event.key !== "Escape" || !open) return;
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }}
      >
        <Icon name="info" />
      </button>
      <span ref={tip} id={id} role="tooltip" popover="manual" hidden={!open} className="info-tip-text">
        {children}
      </span>
    </span>
  );
}
