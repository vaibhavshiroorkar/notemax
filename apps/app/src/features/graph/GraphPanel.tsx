import { useDeferredValue, useMemo } from "react";
import { buildGraph } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { GraphCanvas } from "./GraphCanvas";
import { dotMenu, openDot } from "./GraphView";
import { panelChoices } from "./choices";
import "./graph.css";

/**
 * The small graph in the right sidebar: the pages linked around the open one.
 * It follows along as other pages open, like Obsidian's local graph.
 */
export function GraphPanel({ app }: { app: AppContext }) {
  // Deferred, so a page switch shows the new page first and the graph follows a moment later.
  const center = useDeferredValue(app.activeId!);
  const tree = useDeferredValue(app.tree);
  const choices = panelChoices.use();
  const set = (change: Partial<typeof choices>) => panelChoices.set({ ...panelChoices.get(), ...change });
  const graph = useMemo(
    () => buildGraph(tree, { around: { center, depth: choices.depth }, containers: choices.containers, tags: choices.tags }),
    [tree, center, choices],
  );
  const title = tree.byId.get(center)?.title || "Untitled";
  const links = graph.nodes.length - 1;

  return (
    <div className="graph-panel">
      <GraphCanvas
        graph={graph}
        center={center}
        local
        compact
        className="graph-panel-canvas"
        label={`Pages linked around ${title}`}
        onOpen={(id) => id !== center && openDot(app, id)}
        onDotMenu={(id, x, y) => dotMenu(app, id, x, y)}
      />
      <div className="graph-panel-bar">
        <span className="graph-panel-count">{links > 0 ? `${links} linked` : "No links yet"}</span>
        <select aria-label="Steps out" title="Steps out" value={choices.depth} onChange={(event) => set({ depth: Number(event.target.value) })}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "step" : "steps"}
            </option>
          ))}
        </select>
        <button className="icon-button" aria-label="Show tags in the small graph" aria-pressed={choices.tags} title="Tags" onClick={() => set({ tags: !choices.tags })}>
          <span aria-hidden="true">#</span>
        </button>
        <button className="icon-button" aria-label="Open the full graph" title="Open the full graph" onClick={(event) => app.openView("graph", { local: true, from: app.activeId }, { newTab: event.ctrlKey || event.metaKey })}>
          <Icon name="expand" />
        </button>
      </div>
    </div>
  );
}
