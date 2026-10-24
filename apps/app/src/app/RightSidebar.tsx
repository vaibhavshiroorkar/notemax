import { useEffect, useRef, useState, type DragEvent } from "react";
import { listedOnRight } from "@/features/sidebar/state";
import { workspaceNow } from "@/platform/prefs";
import { createStore } from "@/platform/store";
import type { AppContext, SidePanel } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";
import { usePresence } from "@/ui/usePresence";
import { joinSlot, newSlot, panelLayout, placed, setActive, setOn, type PanelLayout } from "./panelLayout";

const PANEL_TYPE = "application/x-notemax-panel";
/** The section being dragged, so the gaps between boxes can show where it may go. */
const dragging = createStore<string | null>(null);

const isPanelDrag = (event: DragEvent) => event.dataTransfer.types.includes(PANEL_TYPE);

/** Writes the layout with every known section placed, so indexes from the drawn boxes match the saved ones. */
function update(all: SidePanel[], change: (layout: PanelLayout) => PanelLayout) {
  panelLayout.set(change(placed(panelLayout.get(), all.map((p) => p.id))));
}

/** A section dropped somewhere is on, wherever it came from: a box or the tray. */
const dropInto = (all: SidePanel[], id: string, place: (layout: PanelLayout) => PanelLayout) => update(all, (layout) => setOn(place(layout), id, true));

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

/** A drop place between boxes: a section dropped here gets a box of its own. */
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
        if (id) dropInto(all, id, (layout) => newSlot(layout, id, index));
        dragging.set(null);
      }}
    />
  );
}

/** One box: a section under its title, or several as tabs across the top. Dropping a section on it adds a tab. */
function Box({ app, all, index, shown, active }: { app: AppContext; all: SidePanel[]; index: number; shown: SidePanel[]; active: SidePanel }) {
  const [over, setOver] = useState(false);
  const tabs = shown.length > 1;
  return (
    <section
      className="panel-box"
      data-panel={active.id}
      data-tabs={tabs || undefined}
      data-drop={over || undefined}
      aria-label={active.title}
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
        if (id) dropInto(all, id, (layout) => joinSlot(layout, id, index));
        dragging.set(null);
      }}
    >
      <header className="panel-box-head">
        {tabs ? (
          <div className="panel-tabs" role="tablist" aria-label="Sections in this box">
            {shown.map((panel) => (
              <button
                key={panel.id}
                className="panel-tab"
                role="tab"
                aria-selected={panel.id === active.id}
                title="Drag out to give it a box of its own"
                {...dragProps(panel.id)}
                onClick={() => update(all, (layout) => setActive(layout, index, panel.id))}
              >
                {panel.title}
              </button>
            ))}
          </div>
        ) : (
          <span className="panel-box-title" title="Drag onto another box to make tabs" {...dragProps(active.id)}>
            {active.title}
          </span>
        )}
        <button className="icon-button panel-box-close" aria-label={`Hide ${active.title}`} title="Hide. Add it back from Sections below." onClick={() => update(all, (layout) => setOn(layout, active.id, false))}>
          <Icon name="close" />
        </button>
      </header>
      <div className="panel-box-body" role={tabs ? "tabpanel" : undefined}>
        <Safe name={active.title}>
          <active.component app={app} />
        </Safe>
      </div>
    </section>
  );
}

/** The tray at the bottom: every section, to add with a click or drag into place, and starting over. */
function Tray({ all, here }: { all: SidePanel[]; here: Set<string> }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const layout = panelLayout.use();
  const moving = dragging.use();
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
      <button className="footer-button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name="side-panel" />
        <span>Sections</span>
      </button>
      {/* Out of the way while a section is dragged from it, so the boxes above can take the drop. */}
      {open && (
        <div className="menu panels-tray" role="dialog" aria-label="Sections" data-moving={moving || undefined}>
          <p className="panels-tray-hint">Click to add or hide. Drag one onto a box to make tabs, or between boxes for a box of its own.</p>
          <div className="panels-tray-chips">
            {[...all]
              .sort((a, b) => a.order - b.order)
              .map((panel) => {
                const on = !layout.off.includes(panel.id);
                return (
                  <button
                    key={panel.id}
                    className="panels-chip"
                    aria-pressed={on}
                    title={here.has(panel.id) ? undefined : "Shows on other pages"}
                    {...dragProps(panel.id)}
                    // Added at the bottom, where it is easy to see it arrive.
                    onClick={() => (on ? update(all, (l) => setOn(l, panel.id, false)) : dropInto(all, panel.id, (l) => newSlot(l, panel.id, Infinity)))}
                  >
                    <Icon name={on ? "close" : "plus"} />
                    <span>{panel.title}</span>
                    {!here.has(panel.id) && <span className="panels-chip-note">elsewhere</span>}
                  </button>
                );
              })}
          </div>
          <button className="link-button panels-tray-reset" onClick={() => panelLayout.set({ slots: [], off: layout.off })}>
            Put every box back in its own place
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The right sidebar. It is there on every page, and plugins fill it with
 * sections: a book's chapters while a book is open, the calendar, and so on.
 * Each section on shows as a box, open; the rest wait in the tray at the
 * bottom. Dragging a section onto a box makes tabs in that box.
 * It stays on the page a moment after closing, so it can slide out.
 */
/** The right sidebar panel that lists a note's subtopics. */
const SUBTOPICS_PANEL = "notes.subtopics";

export function RightSidebar({ app, panels, all, open }: { app: AppContext; panels: SidePanel[]; all: SidePanel[]; open: boolean }) {
  const mounted = usePresence(open);
  const layout = placed(panelLayout.use(), all.map((p) => p.id));
  const moving = dragging.use();
  // While "On this page" lists the open page's subtopics here, the left sidebar leaves them out.
  const listing = open && app.workspace === workspaceNow() && panels.some((p) => p.id === SUBTOPICS_PANEL) && !layout.off.includes(SUBTOPICS_PANEL) ? app.activeId : null;
  useEffect(() => {
    listedOnRight.set(listing);
    return () => listedOnRight.set(null);
  }, [listing]);
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
            <Box app={app} all={all} index={slot.index} shown={slot.shown} active={slot.active} />
          </div>
        ))}
        {moving && <Gap all={all} index={layout.slots.length} />}
        {slots.length === 0 && <p className="panel-empty">Nothing here yet. Add a calendar, links, the graph and more from Sections below.</p>}
      </div>
      <Tray all={all} here={here} />
    </aside>
  );
}
