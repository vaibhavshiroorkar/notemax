import type * as Y from "yjs";
import { ROOT, createNode, moveNode, type NodeKind } from "@notemax/core";
import { newPagesAt } from "@/platform/behavior";

/**
 * Makes a page someone asked for, at the end of the pages beside it or at the
 * top, as Settings, How it works says. One change, so Undo and other devices
 * never see it at the end first. Pages placed on purpose, like a chapter after
 * another or a day in the Journal, use createNode and their own place instead.
 */
export function addPage(doc: Y.Doc, kind: NodeKind, parentId = ROOT, title = "", setup?: (doc: Y.Doc, id: string) => void): string {
  let id = "";
  doc.transact(() => {
    id = createNode(doc, kind, parentId, title);
    setup?.(doc, id);
    if (newPagesAt.get() === "top") moveNode(doc, id, parentId, 0);
  });
  return id;
}
