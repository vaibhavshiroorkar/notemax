import type { TreeNode } from "@notemax/core";
import { pageMenu } from "@/ui/ContextMenu";
import { Icon } from "@/ui/Icon";

export function BookItemMenu({ node, className = "" }: { node: TreeNode; className?: string }) {
  const title = node.title || (node.kind === "book" ? "Untitled part" : "Untitled");
  return (
    <button className={`icon-button ${className}`} aria-label={`More for ${title}`} aria-haspopup="menu" title="More" onClick={pageMenu(node)}>
      <Icon name="more" />
    </button>
  );
}
