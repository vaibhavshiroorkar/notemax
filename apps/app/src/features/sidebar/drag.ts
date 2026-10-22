import type { DragEvent } from "react";
import { childrenOf, holds, type Tree, type TreeItem } from "@notemax/core";
import { createStore } from "@/platform/store";

export type Zone = "before" | "after" | "inside";
export type DropTarget = { id: string; zone: Zone };
export interface Placement {
  parentId: string;
  index: number;
}

/**
 * Which part of a row the pointer is over decides where the dragged item lands.
 * The middle of a row means inside it. A row that cannot hold the dragged item
 * (a book while a folder is dragged) only has a top and bottom half.
 */
export function zoneFor(event: DragEvent, target: TreeItem, dragged: TreeItem): Zone {
  const rect = event.currentTarget.getBoundingClientRect();
  const y = (event.clientY - rect.top) / rect.height;
  if (!holds(target.kind, dragged.kind)) return y < 0.5 ? "before" : "after";
  return y < 0.25 ? "before" : y > 0.75 ? "after" : "inside";
}

export function placementFor(tree: Tree, dragged: TreeItem, target: TreeItem, zone: Zone): Placement | null {
  if (dragged.id === target.id) return null;
  if (zone === "inside") return { parentId: target.id, index: target.children.length };
  const siblings = childrenOf(tree, target.parentId).filter((item) => item.id !== dragged.id);
  const index = siblings.findIndex((item) => item.id === target.id);
  return { parentId: target.parentId, index: zone === "before" ? index : index + 1 };
}

// The left sidebar and the book panel are separate components, but a drag can
// start in one and end in the other, so the dragged item lives outside both.
export const dragged = createStore<TreeItem | null>(null);

export const startDrag = (item: TreeItem) => dragged.set(item);
export const endDrag = () => dragged.set(null);

export const useDragging = (): TreeItem | null => dragged.use();
