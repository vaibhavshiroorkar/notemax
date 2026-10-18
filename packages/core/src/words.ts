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
