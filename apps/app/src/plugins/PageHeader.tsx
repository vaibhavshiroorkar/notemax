import type { TreeNode } from "@notemax/core";
import { registry } from "./registry";
import type { AppContext } from "./types";

/** What plugins add under a page's title, like its tags. */
export function PageHeader({ node, app }: { node: TreeNode; app: AppContext }) {
  return (
    <>
      {registry.pageHeader(node.kind).map(({ id, component: Addon }) => (
        <Addon key={id} node={node} app={app} />
      ))}
    </>
  );
}
