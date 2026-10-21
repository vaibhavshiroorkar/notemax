import type { TreeNode } from "./workspace";

/** Long enough for "worldbuilding-notes", short enough to fit on a chip. */
export const MAX_TAG_LENGTH = 40;

/**
 * The stored form of a tag, or null when nothing is left. Tags are shared
 * with the public portal later, so "Sci Fi", "#sci-fi" and "SCI-FI" must all
 * become one tag: lowercase, with spaces turned into hyphens.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, MAX_TAG_LENGTH);
  return tag || null;
}

/**
 * True when the node has a tag starting with each of `wanted`. Prefixes, so a
 * search for "#fan" already finds "fanfic" while it is being typed.
 */
export function hasTags(node: TreeNode, wanted: readonly string[]): boolean {
  return wanted.every((want) => node.tags.some((tag) => tag.startsWith(want)));
}
