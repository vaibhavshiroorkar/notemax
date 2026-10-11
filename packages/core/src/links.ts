import * as Y from "yjs";
import type { Tree, TreeNode } from "./workspace";

/** Name of the editor's link node. Stored in note bodies, so it must never change. */
export const WIKI_LINK = "wikiLink";

/** The ids a note body links to, in the order they appear. */
export function extractLinks(body: Y.XmlFragment): string[] {
  const targets: string[] = [];
  for (const element of body.createTreeWalker((el) => el instanceof Y.XmlElement && el.nodeName === WIKI_LINK)) {
    const target = (element as Y.XmlElement).getAttribute("targetId");
    if (typeof target === "string" && target) targets.push(target);
  }
  return targets;
}

/**
 * Visible notes and books whose title matches `query`, best first: exact
 * title, then title start, then word start, then anywhere in the title.
 */
export function searchNodes(tree: Tree, query: string, { limit = 8, exclude }: { limit?: number; exclude?: string } = {}): TreeNode[] {
  const q = query.trim().toLowerCase();
  const scored: [number, TreeNode][] = [];
  for (const id of tree.visible) {
    if (id === exclude) continue;
    const node = tree.byId.get(id)!;
    const title = node.title.toLowerCase();
    let score: number;
    if (!q) score = 3;
    else if (title === q) score = 0;
    else if (title.startsWith(q)) score = 1;
    else if (title.includes(` ${q}`)) score = 2;
    else if (title.includes(q)) score = 3;
    else continue;
    scored.push([score, node]);
  }
  // With no query, the newest notes are the most likely targets.
  scored.sort(([sa, a], [sb, b]) => sa - sb || (q ? a.title.localeCompare(b.title) : b.createdAt - a.createdAt));
  return scored.slice(0, limit).map(([, node]) => node);
}
