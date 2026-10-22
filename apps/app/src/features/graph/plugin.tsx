import type { TreeNode } from "@notemax/core";
import type { AppContext, Plugin } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { GraphPanel } from "./GraphPanel";
import { GraphView } from "./GraphView";

/** The small button at the top right of a page: the pages linked around it. */
function GraphButton({ node, app }: { node: TreeNode; app: AppContext }) {
  return (
    <button className="icon-button" aria-label="Show the links around this page" title="Links around this page" onClick={(event) => app.openView("graph", { local: true, from: node.id }, { newTab: event.ctrlKey || event.metaKey })}>
      <Icon name="graph" />
    </button>
  );
}

export const graphPlugin: Plugin = {
  id: "graph",
  name: "Graph",
  description: "Pages and their links as dots and lines, full size and small in the right sidebar",
  // Last in the right sidebar: it is the largest section and the least often read.
  sidePanels: [{ id: "graph.panel", title: "Graph", order: 90, when: (app) => app.activeId !== null, component: GraphPanel }],
  views: [{ id: "graph", title: "Graph", icon: "graph", component: GraphView }],
  pageCorner: [{ id: "graph.button", component: GraphButton }],
  commands: [
    { id: "graph.open", title: "Open the graph of all pages", keywords: ["map", "links", "network", "connections"], shortcut: "Mod+Shift+G", run: (app) => app.openView("graph", { from: app.activeId }) },
    {
      id: "graph.local",
      title: "Show the links around this page",
      keywords: ["graph", "connections", "backlinks"],
      when: (app) => app.activeId !== null,
      run: (app) => app.openView("graph", { local: true, from: app.activeId }),
    },
  ],
};
