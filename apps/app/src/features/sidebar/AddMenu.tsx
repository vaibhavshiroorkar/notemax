import { useEffect, useRef, useState } from "react";
import type { NodeKind } from "@notemax/core";
import { Icon } from "@/ui/Icon";

const addKinds: { kind: NodeKind; label: string }[] = [
  { kind: "note", label: "New note" },
  { kind: "folder", label: "New folder" },
  { kind: "book", label: "New book" },
];

/** The one + at the top. It asks what to make, since everything shares one list. */
export function AddMenu({ onAdd }: { onAdd(kind: NodeKind): void }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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

  return (
    <div className="add-menu" ref={wrapper}>
      <button className="icon-button" aria-label="New" aria-haspopup="menu" aria-expanded={open} title="New note, folder or book" onClick={() => setOpen(!open)}>
        <Icon name="plus" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {addKinds.map(({ kind, label }, i) => (
            <button key={kind} ref={i === 0 ? first : undefined} role="menuitem" className="menu-item" onClick={() => pick(kind)}>
              <Icon name={kind} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
