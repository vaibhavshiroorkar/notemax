import { marked } from "marked";
import type { Tree } from "@notemax/core";
import { htmlToBody } from "@/features/editor/schema";
import { escapeHtml, toMarkdown, type DocNode, type Resolve } from "@/features/export/serialize";

/** What a file's header keeps that Markdown cannot: the note it belongs to, and its title and tags. */
export interface Front {
  id?: string;
  title?: string;
  tags?: string[];
}

const quote = (text: string) => (/^[\w .,'()-]*$/.test(text) && text.trim() === text && text !== "" ? text : JSON.stringify(text));

export function withFront(front: Front, markdown: string): string {
  const lines = ["---"];
  if (front.id) lines.push(`id: ${front.id}`);
  if (front.title !== undefined) lines.push(`title: ${quote(front.title)}`);
  if (front.tags?.length) lines.push(`tags: [${front.tags.map(quote).join(", ")}]`);
  lines.push("---", "");
  return `${lines.join("\n")}\n${markdown}`;
}

const unquote = (value: string) => {
  const v = value.trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.slice(1, -1);
    }
  }
  return v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1) : v;
};

/** The header and the Markdown after it. A file without a header has an empty one. Only the fields used here are read. */
export function splitFront(text: string): { front: Front; markdown: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { front: {}, markdown: text };
  const front: Front = {};
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const field = /^(\w+):\s*(.*)$/.exec(lines[i]);
    if (!field) continue;
    const [, key, value] = field;
    if (key === "id") front.id = unquote(value);
    else if (key === "title") front.title = unquote(value);
    else if (key === "tags") {
      if (value.trim().startsWith("[")) front.tags = value.trim().slice(1, -1).split(",").map(unquote).filter(Boolean);
      else {
        // The list form: "- tag" on the lines below.
        front.tags = [];
        while (lines[i + 1]?.trim().startsWith("- ")) front.tags.push(unquote(lines[++i].trim().slice(2)));
      }
    }
  }
  return { front, markdown: text.slice(match[0].length).replace(/^\r?\n/, "") };
}

/** A note as a Markdown file: header, then the body, with [[Title]] links and pictures in attachments/. */
export function noteToFile(front: Front, body: DocNode, resolve: Resolve): string {
  return withFront(front, toMarkdown(body, resolve));
}

/**
 * A Markdown file's body as a note body. [[Title]] becomes a link to the page
 * with that title, when there is one. Pictures are handed to `picture`, which
 * keeps the file and says its asset id.
 */
export async function fileToBody(markdown: string, tree: Tree, picture: (path: string) => Promise<string | null>): Promise<DocNode> {
  const byTitle = new Map<string, string>();
  for (const node of tree.byId.values()) if (node.deletedAt === null && node.kind !== "folder") byTitle.set((node.title || "Untitled").toLowerCase(), node.id);
  // Turned into links before Markdown sees them; [[Title|shown]] shows the second part.
  const linked = markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, title: string, shown?: string) => {
    const id = byTitle.get(title.trim().toLowerCase());
    return id ? `<a data-wiki-link data-target="${escapeHtml(id)}">${escapeHtml(shown ?? title.trim())}</a>` : whole;
  });
  const html = await marked.parse(linked, { async: true, gfm: true });
  const doc = new DOMParser().parseFromString(html, "text/html");

  // GitHub-style task lists, as the editor writes its to-dos.
  for (const box of Array.from(doc.querySelectorAll<HTMLInputElement>("li > input[type=checkbox]"))) {
    const item = box.parentElement!;
    item.setAttribute("data-type", "taskItem");
    item.setAttribute("data-checked", String(box.checked));
    item.parentElement?.setAttribute("data-type", "taskList");
    box.remove();
  }
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (/^[a-z]+:/i.test(src)) continue;
    const asset = await picture(decodeURIComponent(src)).catch(() => null);
    if (asset) img.setAttribute("data-asset", asset);
    else img.remove();
  }
  return htmlToBody(doc.body.innerHTML) as DocNode;
}
