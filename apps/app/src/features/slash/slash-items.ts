import type { SlashItem } from "@/plugins/types";

export const BLOCK_ITEMS: SlashItem[] = [
  { title: "Text", hint: "", description: "Plain writing", icon: "text", group: "Basic", keywords: ["paragraph", "plain"], apply: (c) => c.setParagraph() },
  { title: "Heading 1", hint: "#", description: "Big section heading", icon: "heading", group: "Basic", keywords: ["h1", "title"], apply: (c) => c.setHeading({ level: 1 }) },
  { title: "Heading 2", hint: "##", description: "Medium section heading", icon: "heading", group: "Basic", keywords: ["h2", "subtitle"], apply: (c) => c.setHeading({ level: 2 }) },
  { title: "Heading 3", hint: "###", description: "Small section heading", icon: "heading", group: "Basic", keywords: ["h3"], apply: (c) => c.setHeading({ level: 3 }) },
  { title: "Bulleted list", hint: "-", description: "A simple list", icon: "list-bullet", group: "Lists", keywords: ["ul", "unordered", "bullet"], apply: (c) => c.toggleBulletList() },
  { title: "Numbered list", hint: "1.", description: "A list with numbers", icon: "list-number", group: "Lists", keywords: ["ol", "ordered", "number"], apply: (c) => c.toggleOrderedList() },
  { title: "To-do list", hint: "[ ]", description: "Things to check off", icon: "list-check", group: "Lists", keywords: ["todo", "task", "checkbox", "check"], apply: (c) => c.toggleTaskList() },
  { title: "Quote", hint: ">", description: "Words from someone else", icon: "quote", group: "Blocks", keywords: ["blockquote", "citation"], apply: (c) => c.setBlockquote() },
  { title: "Code block", hint: "```", description: "Code in a fixed-width font", icon: "code", group: "Blocks", keywords: ["code", "pre"], apply: (c) => c.setCodeBlock() },
  { title: "Divider", hint: "---", description: "A line across the page", icon: "minus", group: "Blocks", keywords: ["hr", "line", "rule", "separator"], apply: (c) => c.setHorizontalRule() },
];

/** How well an item matches, lower is better, or null for no match. */
function rank(item: SlashItem, q: string): number | null {
  const title = item.title.toLowerCase();
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  const words = title.split(/[\s-]+/);
  // Initials, like "bl" for Bulleted list or "tdl" for To-do list.
  if (q.length > 1 && words.map((word) => word[0]).join("").startsWith(q)) return 1.5;
  if (words.some((word) => word.startsWith(q))) return 2;
  if (item.keywords.some((word) => word.startsWith(q))) return 3;
  // Letters in order, like "bl" for "Bulleted list" or "hd2" for "Heading 2".
  let at = 0;
  for (const ch of title) if (ch === q[at]) at++;
  return at === q.length ? 4 : null;
}

/**
 * The items for what was typed after /, best first. "list" finds all three
 * lists, "h2" the second heading, and "bl" the bulleted list. Equal matches
 * keep their menu order.
 */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items
    .map((item, i) => ({ item, i, score: rank(item, q) }))
    .filter((entry) => entry.score !== null)
    .sort((a, b) => a.score! - b.score! || a.i - b.i)
    .map((entry) => entry.item);
}
