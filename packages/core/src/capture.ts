import * as Y from "yjs";
import { openLocalDoc } from "./local-doc";
import type { DocStore } from "./store";
import { ROOT, WORKSPACE_DOC_ID, createNode } from "./workspace";

/**
 * Splits quick-capture text into a title (the first line) and body paragraphs.
 * Returns null when there is nothing to save.
 */
export function splitCapture(text: string): { title: string; body: string[] } | null {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return null;
  return { title: lines[0].trim(), body: lines.slice(1) };
}

/**
 * Saves a quick note at the top level and returns its id, or null for empty
 * text. It is not filed into a folder: sorting happens later, in the main window.
 */
export async function captureNote(store: DocStore, text: string, options: { broadcast?: string } = {}): Promise<string | null> {
  const parts = splitCapture(text);
  if (!parts) return null;
  // Capture opens these docs briefly, so merging their logs is the main window's job.
  const docOptions = { ...options, compactAbove: Infinity };
  const id = crypto.randomUUID();

  // Body first, tree second. A crash in between leaves an unlisted body,
  // never a listed note whose text is missing.
  if (parts.body.length) {
    const note = await openLocalDoc(store, id, docOptions);
    note.doc.transact(() => {
      // Same shape the editor writes: one paragraph element per line.
      const paragraphs = parts.body.map((line) => {
        const paragraph = new Y.XmlElement("paragraph");
        if (line) paragraph.insert(0, [new Y.XmlText(line)]);
        return paragraph;
      });
      note.doc.getXmlFragment("content").insert(0, paragraphs);
    });
    await note.close();
  }

  const workspace = await openLocalDoc(store, WORKSPACE_DOC_ID, docOptions);
  try {
    createNode(workspace.doc, "note", ROOT, parts.title, id);
  } finally {
    await workspace.close();
  }
  return id;
}
