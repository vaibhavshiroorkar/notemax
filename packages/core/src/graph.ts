import { ROOT, isContainer, type NodeKind, type Tree } from "./workspace";

export interface GraphNode {
  id: string;
  title: string;
  /** A tag dot stands for every page with that tag. Its id is "tag:" and the tag. */
  kind: NodeKind | "tag";
  /** How many lines touch it. Bigger dots for busier pages. */
  degree: number;
  /** Steps from the center page in a local graph, 0 for the center. Undefined in a full graph. */
  depth?: number;
  /** How deep the page sits in the sidebar: 0 at the top level. Undefined for tags. */
  level?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** A [[link]] between pages, a page sitting in a folder or book, or a page with a tag. */
  kind: "link" | "contains" | "tagged";
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** The id of a tag's dot. Page ids never start with "tag:". */
export const tagDot = (tag: string) => `tag:${tag}`;

export interface GraphOptions {
  /** Only pages within `depth` steps of `center`. Left out, everything. */
  around?: { center: string; depth: number };
  /** Show folders and books as dots, joined to what they hold. */
  containers?: boolean;
  /** Leave out pages with no lines at all. */
  hideLonely?: boolean;
  /** Show each tag as a dot, joined to the pages that have it. */
  tags?: boolean;
}

/**
 * The pages in the sidebar as dots, and the links between them as lines. A
 * local graph walks out from its center page and never looks at the rest, so
 * it stays quick in a workspace of thousands of pages.
 */
export function buildGraph(tree: Tree, { around, containers = false, hideLonely = false, tags = false }: GraphOptions = {}): Graph {
  const shown = (id: string) => {
    const node = tree.byId.get(id);
    return !!node && tree.visible.has(id) && (containers || !isContainer(node.kind));
  };

  // Pages by tag, built only when a tag dot needs its pages.
  let tagPages: Map<string, string[]> | null = null;
  const pagesWith = (tag: string) => {
    if (!tagPages) {
      tagPages = new Map();
      for (const id of tree.visible) {
        if (!shown(id)) continue;
        for (const t of tree.byId.get(id)!.tags) tagPages.set(t, [...(tagPages.get(t) ?? []), id]);
      }
    }
    return tagPages.get(tag) ?? [];
  };

  // Every line touching one dot, found from what that dot itself knows.
  const linesOf = (id: string): GraphEdge[] => {
    if (id.startsWith("tag:")) return pagesWith(id.slice(4)).map((page) => ({ source: page, target: id, kind: "tagged" }));
    const node = tree.byId.get(id)!;
    const out: GraphEdge[] = [];
    for (const target of node.links) if (target !== id && shown(target)) out.push({ source: id, target, kind: "link" });
    for (const source of tree.backlinks.get(id) ?? []) if (source.id !== id && shown(source.id)) out.push({ source: source.id, target: id, kind: "link" });
    if (containers) {
      const item = tree.items.get(id);
      if (item?.parentId && shown(item.parentId)) out.push({ source: item.parentId, target: id, kind: "contains" });
      for (const child of item?.children ?? []) if (shown(child.id)) out.push({ source: id, target: child.id, kind: "contains" });
    }
    if (tags) for (const tag of node.tags) out.push({ source: id, target: tagDot(tag), kind: "tagged" });
    return out;
  };

  let ids: string[];
  const depthOf = new Map<string, number>();
  if (around && shown(around.center)) {
    depthOf.set(around.center, 0);
    let ring = [around.center];
    for (let step = 1; step <= around.depth && ring.length; step++) {
      const next: string[] = [];
      for (const id of ring) {
        for (const line of linesOf(id)) {
          const other = line.source === id ? line.target : line.source;
          if (depthOf.has(other)) continue;
          depthOf.set(other, step);
          next.push(other);
        }
      }
      ring = next;
    }
    ids = [...depthOf.keys()];
  } else {
    const pages = [...tree.visible].filter(shown);
    const tagIds = tags ? [...new Set(pages.flatMap((id) => tree.byId.get(id)!.tags))].sort().map(tagDot) : [];
    ids = [...pages, ...tagIds];
  }

  const has = new Set(ids);
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    for (const line of linesOf(id)) {
      if (!has.has(line.source) || !has.has(line.target)) continue;
      // Each line is found from both of its ends, and a link both ways is one line.
      const key = `${line.kind} ${line.source < line.target ? `${line.source} ${line.target}` : `${line.target} ${line.source}`}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(line);
    }
  }

  const degree = new Map<string, number>();
  for (const edge of edges) for (const end of [edge.source, edge.target]) degree.set(end, (degree.get(end) ?? 0) + 1);

  // Counted along the shown tree, so a page moved into a folder grows smaller at once.
  const levelOf = (id: string) => {
    let level = 0;
    for (let item = tree.items.get(id); item && item.parentId !== ROOT && level < 64; item = tree.items.get(item.parentId)) level++;
    return level;
  };

  const nodes = ids
    .filter((id) => !hideLonely || degree.has(id) || id === around?.center)
    .map((id): GraphNode => {
      const node = tree.byId.get(id);
      if (!node) return { id, title: `#${id.slice(4)}`, kind: "tag", degree: degree.get(id) ?? 0, depth: depthOf.get(id) };
      return { id, title: node.title, kind: node.kind, degree: degree.get(id) ?? 0, depth: depthOf.get(id), level: levelOf(id) };
    });
  return { nodes, edges };
}
