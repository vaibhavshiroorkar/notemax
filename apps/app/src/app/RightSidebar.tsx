import { useEffect, useRef, useState, type DragEvent } from "react";
import { createStore } from "@/platform/store";
import type { AppContext, SidePanel } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";
import { usePresence } from "@/ui/usePresence";
import { joinSlot, newSlot, panelLayout, panelOpen, placed, setActive, setOn, type PanelLayout } from "./panelLayout";

const PANEL_TYPE = "application/x-notemax-panel";
/** The section being dragged, so the gaps between slots can show where it may go. */
const dragging = createStore<string | null>(null);

const isPanelDrag = (event: DragEvent) => event.dataTransfer.types.includes(PANEL_TYPE);

/** Writes the layout with every known section placed, so indexes from the drawn slots match the saved ones. */
function update(all: SidePanel[], change: (layout: PanelLayout) => PanelLayout) {
  panelLayout.set(change(placed(panelLayout.get(), all.map((p) => p.id))));
}

function dragProps(id: string) {
  return {
    draggable: true,
    onDragStart(event: DragEvent) {
      event.dataTransfer.setData(PANEL_TYPE, id);
      event.dataTransfer.effectAllowed = "move";
      dragging.set(id);
    },
    onDragEnd: () => dragging.set(null),
  };
}

/** A drop place between slots: a section dropped here gets a slot of its own. */
function Gap({ all, index }: { all: SidePanel[]; index: number }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="panel-gap"
      data-over={over || undefined}
      onDragOver={(event) => {
        if (!isPanelDrag(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData(PANEL_TYPE);
        if (id) update(all, (layout) => newSlot(layout, id, index));
        dragging.set(null);
      }}
    />
  );
}

/** One slot: a single section under its title, or several as tabs. */
function SlotView({ app, all, index, shown, active }: { app: AppContext; all: SidePanel[]; index: number; shown: SidePanel[]; active: SidePanel }) {
  const open = !!panelOpen.use()[active.id];
  const [over, setOver] = useState(false);
  const toggle = () => panelOpen.set({ ...panelOpen.get(), [active.id]: !open });
  const tabs = shown.length > 1;
  return (
    <section
      className="panel-section"
      data-panel={active.id}
      data-tabs={tabs || undefined}
      data-folded={!open || undefined}
      data-drop={over || undefined}
      onDragOver={(event) => {
        if (!isPanelDrag(event)) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node | null) && setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = event.dataTransfer.getData(PANEL_TYPE);
        if (id) update(all, (layout) => joinSlot(layout, id, index));
        dragging.set(null);
      }}
    >
      {tabs ? (
        <div className="panel-tabs" role="tablist" aria-label="Sections">
          <button className="panel-fold" aria-label={open ? "Fold" : "Unfold"} aria-expanded={open} onClick={toggle}>
            <Icon name="chevron-down" />
          </button>
          {shown.map((panel) => (
            <button
              key={panel.id}
              className="panel-section-title panel-tab"
              role="tab"
              aria-selected={panel.id === active.id}
              {...dragProps(panel.id)}
              onClick={() => {
                if (panel.id === active.id) return toggle();
                update(all, (layout) => setActive(layout, index, panel.id));
                panelOpen.set({ ...panelOpen.get(), [panel.id]: true });
              }}
            >
              {panel.title}
            </button>
          ))}
        </div>
      ) : (
        <button className="panel-section-title" aria-expanded={open} title="Drag onto another section to make tabs" onClick={toggle} {...dragProps(active.id)}>
          <Icon name="chevron-down" />
          <span>{active.title}</span>
        </button>
      )}
      {open && (
        <Safe name={active.title}>
          <active.component app={app} />
        </Safe>
      )}
    </section>
  );
}

/** The bar at the bottom: which sections are on, and starting the layout over. */
function PanelsMenu({ all, here }: { all: SidePanel[]; here: Set<string> }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const layout = panelLayout.use();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !wrapper.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="side-panel-bottom" ref={wrapper}>
      <button className="footer-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="side-panel" />
        <span>Sections</span>
      </button>
      {open && (
        <div className="menu panels-menu" role="menu" aria-label="Sections">
          {[...all]
            .sort((a, b) => a.order - b.order)
            .map((panel) => (
              <label key={panel.id} className="menu-item panels-menu-item" role="menuitemcheckbox" aria-checked={!layout.off.includes(panel.id)}>
                <input type="checkbox" checked={!layout.off.includes(panel.id)} onChange={(event) => update(all, (l) => setOn(l, panel.id, event.target.checked))} />
                <span>{panel.title}</span>
                {!here.has(panel.id) && <span className="panels-menu-note">not on this page</span>}
              </label>
            ))}
          <hr />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              panelLayout.set({ slots: [], off: panelLayout.get().off });
              panelOpen.set({});
            }}
          >
            Fold all and undo moves
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The right sidebar. It is there on every page, and plugins fill it with
 * sections: a book's chapters while a book is open, the calendar, and so on.
 * Sections start folded, and the ones turned off wait in the bar at the bottom.
 * Each sits in a slot; dragging one onto another makes tabs in that slot.
 * It stays on the page a moment after closing, so it can slide out.
 */
export function RightSidebar({ app, panels, all, open }: { app: AppContext; panels: SidePanel[]; all: SidePanel[]; open: boolean }) {
  const mounted = usePresence(open);
  const layout = placed(panelLayout.use(), all.map((p) => p.id));
  const moving = dragging.use();
  if (!mounted) return null;

  const here = new Set(panels.map((p) => p.id));
  const byId = new Map(panels.map((p) => [p.id, p]));
  const slots = layout.slots
    .map((slot, index) => {
      const shown = slot.panels.filter((id) => byId.has(id) && !layout.off.includes(id)).map((id) => byId.get(id)!);
      const active = shown.find((p) => p.id === slot.active) ?? shown[0];
      return { index, shown, active };
    })
    .filter((slot) => slot.shown.length > 0);

  return (
    <aside className="side-panel" aria-label="Right sidebar" data-moving={moving || undefined}>
      <div className="side-panel-sections">
        {slots.map((slot) => (
          <div key={slot.shown.map((p) => p.id).join()} className="panel-slot">
            {moving && <Gap all={all} index={slot.index} />}
            <SlotView app={app} all={all} index={slot.index} shown={slot.shown} active={slot.active} />
          </div>
        ))}
        {moving && <Gap all={all} index={layout.slots.length} />}
        {slots.length === 0 && <p className="panel-empty">No sections here. Turn some on below.</p>}
      </div>
      <PanelsMenu all={all} here={here} />
    </aside>
  );
}
