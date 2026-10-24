import type { ReactNode } from "react";
import type { TreeNode } from "@notemax/core";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";

/** A page wrapped in every gate it must get past, like a lock, wherever it is drawn. */
export function Gated({ node, app, children }: { node: TreeNode; app: AppContext; children: ReactNode }) {
  return registry.gatesFor(node).reduceRight<ReactNode>((inside, { id, component: Gate }) => (
    <Gate key={id} node={node} app={app}>
      {inside}
    </Gate>
  ), children);
}
