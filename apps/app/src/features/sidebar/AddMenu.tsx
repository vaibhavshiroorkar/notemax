import { useEffect, useRef, useState } from "react";
import type { NodeKind } from "@notemax/core";
import { registry } from "@/plugins/registry";
import { Icon } from "@/ui/Icon";

/**
 * The one + at the top. Notes, folders and books are listed; the other kinds,
 * like boards and code, sit in an Others flyout so the list stays short.
 */
export function AddMenu({ onAdd }: { onAdd(kind: NodeKind): void }) {
  const [open, setOpen] = useState(false);
  const [others, setOthers] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return setOthers(false);
    first.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
              {others && (
                <div className="menu menu-flyout" role="menu" aria-label="Other kinds of page">
                  {rest.map(({ kind, label, icon }) => (
                    <button key={kind} role="menuitem" className="menu-item" onClick={() => pick(kind)}>
                      <Icon name={icon} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
