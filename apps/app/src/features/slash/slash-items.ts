import type { SlashItem } from "@/plugins/types";

export const BLOCK_ITEMS: SlashItem[] = [
  { title: "Text", hint: "", keywords: ["paragraph", "plain"], apply: (c) => c.setParagraph() },
  { title: "Heading 1", hint: "#", keywords: ["h1", "title"], apply: (c) => c.setHeading({ level: 1 }) },
  { title: "Heading 2", hint: "##", keywords: ["h2", "subtitle"], apply: (c) => c.setHeading({ level: 2 }) },
  { title: "Heading 3", hint: "###", keywords: ["h3"], apply: (c) => c.setHeading({ level: 3 }) },
  { title: "Bulleted list", hint: "-", keywords: ["ul", "unordered", "bullet"], apply: (c) => c.toggleBulletList() },
  { title: "Numbered list", hint: "1.", keywords: ["ol", "ordered", "number"], apply: (c) => c.toggleOrderedList() },
  { title: "To-do list", hint: "[ ]", keywords: ["todo", "task", "checkbox", "check"], apply: (c) => c.toggleTaskList() },
  { title: "Quote", hint: ">", keywords: ["blockquote", "citation"], apply: (c) => c.setBlockquote() },
  { title: "Code block", hint: "```", keywords: ["code", "pre"], apply: (c) => c.setCodeBlock() },
  { title: "Divider", hint: "---", keywords: ["hr", "line", "rule", "separator"], apply: (c) => c.setHorizontalRule() },
];

/** Matches the start of any word in the title or keywords, so "list" finds all three lists. */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    [...item.title.toLowerCase().split(/[\s-]+/), item.title.toLowerCase(), ...item.keywords].some((word) => word.startsWith(q)),
  );
}
