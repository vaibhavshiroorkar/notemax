import type { Tree, TreeItem } from "@notemax/core";

/** The open book, or the book the open chapter belongs to. */
export function bookOf(tree: Tree, activeId: string | null): TreeItem | undefined {
  const active = activeId ? tree.items.get(activeId) : undefined;
  if (active?.kind === "book") return active;
  const parent = active && tree.items.get(active.parentId);
  return parent?.kind === "book" ? parent : undefined;
}
