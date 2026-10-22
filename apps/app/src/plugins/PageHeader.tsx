import type { TreeNode } from "@notemax/core";
import { Safe } from "@/ui/Safe";
import { registry } from "./registry";
import type { AppContext, PageAddon } from "./types";

function Addons({ addons, node, app }: { addons: PageAddon[]; node: TreeNode; app: AppContext }) {
  return (
    <>
      {addons.map(({ id, component: Addon }) => (
        <Safe key={id} name={id}>
          <Addon node={node} app={app} />
        </Safe>
      ))}
    </>
  );
}

/** What plugins add under a page's title, like its tags. */
export function PageHeader({ node, app }: { node: TreeNode; app: AppContext }) {
  return <Addons addons={registry.pageHeader(node.kind)} node={node} app={app} />;
}

/** What plugins add at the end of a page, like the notes that link to it. */
export function PageFooter({ node, app }: { node: TreeNode; app: AppContext }) {
  return <Addons addons={registry.pageFooter(node.kind)} node={node} app={app} />;
}
