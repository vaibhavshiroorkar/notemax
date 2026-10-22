import * as Y from "yjs";

/** Words in a note body. Text in separate blocks never runs together into one word. */
export function countWords(body: Y.XmlFragment): number {
  let words = 0;
  for (const node of body.createTreeWalker((el) => el instanceof Y.XmlText)) {
    const text = (node as Y.XmlText)
      .toDelta()
      .map((op: { insert: unknown }) => (typeof op.insert === "string" ? op.insert : " "))
      .join("");
    words += text.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

// Nodes that sit inside a line of text rather than making their own block.
const INLINE = new Set(["wikiLink", "hardBreak", "image", "mention"]);

/**
 * A note body as plain text: one line per paragraph, heading or list item,
 * and a [[link]] as its label.
 */
export function plainText(body: Y.XmlFragment): string {
  const lines: string[] = [];
  const walk = (parent: Y.XmlFragment | Y.XmlElement) => {
    let line = "";
    const flush = () => {
      if (line) lines.push(line);
      line = "";
    };
    for (const child of parent.toArray()) {
      if (child instanceof Y.XmlText) {
        line += child.toDelta().map((op: { insert: unknown }) => (typeof op.insert === "string" ? op.insert : "")).join("");
      } else if (child instanceof Y.XmlElement && INLINE.has(child.nodeName)) {
        if (child.nodeName === "hardBreak") line += "\n";
        else if (child.nodeName === "wikiLink") line += String(child.getAttribute("label") ?? "");
      } else if (child instanceof Y.XmlElement) {
        flush();
        walk(child);
      }
    }
    flush();
  };
  walk(body);
  return lines.join("\n");
}
