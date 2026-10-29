import { useEffect, useRef, useState } from "react";
import { GROUPS, pickFiles } from "@/features/open-files/open";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { useDismiss } from "@/ui/useDismiss";

/**
 * Open, beside Create at the top: files from the computer, by kind. Each
 * asks for files and opens them as pages at the end of the list.
 */
export function OpenMenu({ app }: { app: AppContext }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => void (open && first.current?.focus()), [open]);
  useDismiss(open, () => setOpen(false), wrapper);

  return (
    <div className="open-menu" ref={wrapper}>
      <button className="icon-button" aria-label="Open" aria-haspopup="menu" aria-expanded={open} title="Open files from this computer" onClick={() => setOpen(!open)}>
        <Icon name="folder" />
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Open files">
          {GROUPS.map(({ id, title }, i) => (
            <button
              key={id}
              ref={i === 0 ? first : undefined}
              role="menuitem"
              className="menu-item"
              onClick={() => {
                setOpen(false);
                pickFiles(app, id, null);
              }}
            >
              <span>{title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
