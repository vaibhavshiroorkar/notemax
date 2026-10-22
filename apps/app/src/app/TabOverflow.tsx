import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/ui/Icon";
import { activateTab, closeTab, type Tab } from "./tabs";

export interface HiddenTab {
  tab: Tab;
  title: string;
  icon: IconName;
}

/** "+3" after the tabs that fit: a menu of the rest, to switch to or close. */
export function TabOverflow({ hidden }: { hidden: HiddenTab[] }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  // The last hidden tab was closed from the menu.
  useEffect(() => {
    if (!hidden.length) setOpen(false);
  }, [hidden.length]);

  return (
    <div className="tab-more-wrap" ref={wrapper}>
      <button
        className="tab-more"
        aria-label={`${hidden.length} more ${hidden.length === 1 ? "tab" : "tabs"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More tabs"
        onClick={() => setOpen(!open)}
      >
        +{hidden.length}
      </button>
      {open && (
        <div className="menu tab-more-menu" role="menu" aria-label="More tabs">
          {hidden.map(({ tab, title, icon }) => (
            <div key={tab.id} className="tab-more-item">
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  activateTab(tab.id);
                  setOpen(false);
                }}
              >
                <Icon name={icon} />
                <span className="tab-title">{title}</span>
              </button>
              <button className="icon-button" aria-label={`Close ${title}`} title="Close tab" onClick={() => closeTab(tab.id)}>
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
