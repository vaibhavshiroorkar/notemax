import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NodeKind } from "@notemax/core";
import { registry } from "@/plugins/registry";
import { Icon } from "@/ui/Icon";

/**
 * The one + at the top. Notes, folders and books are listed; the other kinds,
 * like boards and code, sit in an Others flyout so the list stays short.
 *
 * The flyout opens past the sidebar's edge, where the sidebar would cut it
 * off, so it is drawn as a popover above everything. A phone shows it inside
 * the menu instead.
 */
export function AddMenu({ onAdd }: { onAdd(kind: NodeKind): void }) {
  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const othersButton = useRef<HTMLButtonElement>(null);
  const flyout = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const narrow = typeof matchMedia === "function" && matchMedia("(max-width: 700px)").matches;

  useEffect(() => {
    if (!open) return setOthers(false);
    first.current?.focus();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapper.current?.contains(target) && !flyout.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Beside the menu, on whichever side has room, and up when it would run off the bottom.
  useLayoutEffect(() => {
    if (!others || narrow) return setPlace(null);
    const el = flyout.current;
    const button = othersButton.current;
    const menu = button?.closest(".menu")?.getBoundingClientRect();
    if (!el || !button || !menu) return;
    el.showPopover?.();
    const { width, height } = el.getBoundingClientRect();
    const margin = 6;
    const left = menu.right + 4 + width <= innerWidth - margin ? menu.right + 4 : Math.max(margin, menu.left - width - 4);
    const top = Math.min(button.getBoundingClientRect().top - 5, innerHeight - height - margin);
    setPlace({ left, top: Math.max(margin, top) });
    if (document.activeElement === button) el.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [others, narrow]);

  const pick = (kind: NodeKind) => {
    setOpen(false);
    onAdd(kind);
  };
  const kinds = registry.kinds();
  const main = kinds.filter((info) => !info.other);
  const rest = kinds.filter((info) => info.other);

  return (
    <div className="add-menu" ref={wrapper}>
      <button className="icon-button" aria-label="New" aria-haspopup="menu" aria-expanded={open} title="New" onClick={() => setOpen(!open)}>
        <Icon name="plus" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {main.map(({ kind, label, icon }, i) => (
            <button key={kind} ref={i === 0 ? first : undefined} role="menuitem" className="menu-item" onClick={() => pick(kind)} onMouseEnter={() => setOthers(false)}>
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
          {rest.length > 0 && (
            <div className="menu-others" onMouseEnter={() => setOthers(true)}>
              <button
                ref={othersButton}
                role="menuitem"
                className="menu-item"
                aria-haspopup="menu"
                aria-expanded={others}
                onClick={() => setOthers(true)}
                onKeyDown={(event) => event.key === "ArrowRight" && setOthers(true)}
              >
                <Icon name="more" />
                <span>Others</span>
                <Icon name="chevron-right" />
              </button>
              {others &&
                (() => {
                  const list = (
                    <div
                      ref={flyout}
                      className={narrow ? "menu menu-flyout" : "menu menu-flyout menu-floating"}
                      role="menu"
                      aria-label="Other kinds of page"
                      popover={narrow ? undefined : "manual"}
                      style={narrow ? undefined : { left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? "visible" : "hidden" }}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowLeft" && event.key !== "Escape") return;
                        event.stopPropagation();
                        setOthers(false);
                        othersButton.current?.focus();
                      }}
                    >
                      {rest.map(({ kind, label, icon }) => (
                        <button key={kind} role="menuitem" className="menu-item" onClick={() => pick(kind)}>
                          <Icon name={icon} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  );
                  return narrow ? list : createPortal(list, document.body);
                })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
