import type { TreeNode } from "@notemax/core";
import { resolver } from "@/features/export/content";
import { partsOf } from "@/features/export/formats";
import { toPlainText, type DocNode, type Resolve } from "@/features/export/serialize";
import type { AppContext } from "@/plugins/types";
import type { NewPost } from "./api";

/**
 * A page's body as readers elsewhere can show it: [[links]] become their title
 * as text, since readers do not have the linked pages, and pictures and videos
 * kept only on this device are left out. Pictures from the web stay.
 */
function forReaders(node: DocNode, r: Resolve): DocNode | null {
  if (node.type === "wikiLink") {
    const id = typeof node.attrs?.targetId === "string" ? node.attrs.targetId : "";
    const label = typeof node.attrs?.label === "string" ? node.attrs.label : "";
    return { type: "text", text: r.title(id) ?? (label || "a page") };
  }
  if (node.type === "video") return null;
  if (node.type === "image" && !(typeof node.attrs?.src === "string" && node.attrs.src.startsWith("https://"))) return null;
  if (!node.content) return node;
  return { ...node, content: node.content.map((child) => forReaders(child, r)).filter((child): child is DocNode => child !== null) };
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** What gets posted from a note or book: its parts as they are now, with plain text for search. */
export async function snapshotOf(node: TreeNode, app: AppContext, summary: string, tags: string[]): Promise<NewPost> {
  const { parts } = await partsOf(node, app, { boards: false });
  const r = resolver(app.tree);
  const ready = parts.map((part) => ({ title: part.title, level: part.level, body: forReaders(part.body, r) ?? { type: "doc", content: [] } }));
  const text = ready.map((part) => (part.title ? `${part.title}\n` : "") + toPlainText(part.body, r)).join("\n\n");
  return {
    source_id: node.id,
    kind: node.kind === "book" ? "book" : "note",
    title: node.title || (node.kind === "book" ? "Untitled book" : "Untitled"),
    summary: summary.trim(),
    tags,
    parts: ready,
    words: countWords(text),
    text_content: text,
  };
}
