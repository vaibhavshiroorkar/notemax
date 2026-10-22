import { savedStore } from "@/platform/store";
import type { AppContext, SidePanel } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";
import { usePresence } from "@/ui/usePresence";

/** Sections folded by their title, by id. Kept per device. */
const folded = savedStore<Record<string, boolean>>("panelFolded", {});

/**
 * The right sidebar. It is there on every page, and plugins fill it with
 * sections: a book's chapters while a book is open, the small graph, and so on.
 * It stays on the page a moment after closing, so it can slide out.
 */
export function RightSidebar({ app, panels, open }: { app: AppContext; panels: SidePanel[]; open: boolean }) {
  const mounted = usePresence(open);
  const fold = folded.use();
  if (!mounted) return null;
  return (
    <aside className="side-panel" aria-label="Right sidebar">
      <div className="side-panel-sections">
        {panels.map((panel) => {
          const closed = !!fold[panel.id];
          return (
            <section key={panel.id} className="panel-section" data-panel={panel.id} data-folded={closed || undefined}>
              <button
                className="panel-section-title"
                aria-expanded={!closed}
                onClick={() => folded.set({ ...folded.get(), [panel.id]: !closed })}
              >
                <Icon name="chevron-down" />
                <span>{panel.title}</span>
              </button>
              {!closed && (
                <Safe name={panel.title}>
                  <panel.component app={app} />
                </Safe>
              )}
            </section>
          );
        })}
        {panels.length === 0 && <p className="panel-empty">Nothing to show here for this page.</p>}
      </div>
    </aside>
  );
}
