import { useMemo, useState } from "react";
import { buildGraph } from "@notemax/core";
import { recentPages } from "@/data/recent";
import { toggleTagFilter } from "@/features/tags/filter";
import type { AppContext } from "@/plugins/types";
import { openContextMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";
import { GraphCanvas } from "./GraphCanvas";
import { graphChoices } from "./choices";
import "./graph.css";

/** A right click on a page's dot shows the page's menu. Tags have none. */
export function dotMenu(app: AppContext, id: string, x: number, y: number) {
  const node = app.tree.byId.get(id);
  if (node) openContextMenu({ type: "page", node }, x, y);
}

/** Opens a dot: a page opens, and a tag filters the sidebar by it. */
export function openDot(app: AppContext, id: string) {
  if (id.startsWith("tag:")) {
    toggleTagFilter(id.slice(4));
    app.showSidebar();
  } else app.open(id);
}

/**
 * The graph as a page of its own, in a tab. "Around this page" centers on the
 * page it was opened from, or else the last page opened.
 */
export function GraphView({ app, options }: { app: AppContext; options: Record<string, unknown> }) {
  const from = typeof options.from === "string" && app.tree.items.has(options.from) ? options.from : recentPages.get().find((id) => app.tree.items.has(id));
  const center = from ?? null;
  const [local, setLocal] = useState(options.local === true && !!center);
  const choices = graphChoices.use();
  const [find, setFind] = useState("");
  const set = (change: Partial<typeof choices>) => graphChoices.set({ ...graphChoices.get(), ...change });

  const graph = useMemo(
    () => buildGraph(app.tree, { around: local && center ? { center, depth: choices.depth } : undefined, containers: choices.containers, hideLonely: choices.hideLonely, tags: choices.tags }),
    [app.tree, local, center, choices],
  );
  const centerTitle = center ? app.tree.byId.get(center)?.title || "Untitled" : "";
  const pages = graph.nodes.filter((n) => n.kind !== "tag").length;

  return (
    <div className="graph-page">
      <header className="graph-header">
        <h1 className="graph-title">Graph</h1>
        <div className="segmented" role="radiogroup" aria-label="Show">
          <button role="radio" aria-checked={!local} onClick={() => setLocal(false)}>
            Everything
          </button>
          <button role="radio" aria-checked={local} disabled={!center} onClick={() => setLocal(true)}>
            Around this page
          </button>
        </div>
        {local && (
          <label className="graph-option">
            Steps
            <select value={choices.depth} onChange={(event) => set({ depth: Number(event.target.value) })}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="graph-option">
          <input type="checkbox" checked={choices.tags} onChange={(event) => set({ tags: event.target.checked })} />
          Tags
        </label>
        <label className="graph-option">
          <input type="checkbox" checked={choices.containers} onChange={(event) => set({ containers: event.target.checked })} />
          Folders and books
        </label>
        <label className="graph-option">
          <input type="checkbox" checked={choices.hideLonely} onChange={(event) => set({ hideLonely: event.target.checked })} />
          Hide pages without links
        </label>
        <label className="settings-search graph-find">
          <Icon name="search" />
          <input type="search" placeholder="Find a page" aria-label="Find a page" data-autofocus value={find} onChange={(event) => setFind(event.target.value)} />
        </label>
      </header>
      <GraphCanvas
        graph={graph}
        center={center}
        local={local}
        find={find}
        label={local ? `Pages linked around ${centerTitle}` : "All pages and their links"}
        onOpen={(id) => openDot(app, id)}
        onDotMenu={(id, x, y) => dotMenu(app, id, x, y)}
      />
      <p className="graph-footer">
        {pages} {pages === 1 ? "page" : "pages"}, {graph.edges.filter((e) => e.kind === "link").length} links. Click a dot to open it, drag to move, scroll to zoom.
      </p>
    </div>
  );
}
