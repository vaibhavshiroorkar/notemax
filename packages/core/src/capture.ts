import * as Y from "yjs";
import { openLocalDoc } from "./local-doc";
import type { DocStore } from "./store";
import { parseWhen } from "./when";
import { ROOT, WORKSPACE_DOC_ID, createNode, readTree, restoreNode } from "./workspace";

/** The note quick capture puts to-dos in. Not "inbox": older workspaces used that id as a parent. */
export const INBOX_ID = "task-inbox";
const TASK_LINE = /^\s*(?:-\s*)?\[\s?\]\s+/;

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
export async function captureNote(store: DocStore, text: string, options: { broadcast?: string; now?: Date } = {}): Promise<string | null> {
  const parts = splitCapture(text);
  if (!parts) return null;
  // Capture opens these docs briefly, so merging their logs is the main window's job.
  const docOptions = { broadcast: options.broadcast, compactAbove: Infinity };
  const lines = [parts.title, ...parts.body].filter((line) => line.trim());
  if (lines.every((line) => TASK_LINE.test(line))) return captureTasks(store, lines, docOptions, options.now ?? new Date());
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

/**
 * Adds to-do lines, like "[ ] buy milk tomorrow", to the end of the Inbox
 * note, making the note first if there is none. Their dates are read the way
 * the editor reads them.
 */
async function captureTasks(store: DocStore, lines: string[], docOptions: { broadcast?: string; compactAbove: number }, now: Date): Promise<string> {
  const note = await openLocalDoc(store, INBOX_ID, docOptions);
  note.doc.transact(() => {
    const content = note.doc.getXmlFragment("content");
    const last = content.length ? content.get(content.length - 1) : null;
    let list: Y.XmlElement;
    if (last instanceof Y.XmlElement && last.nodeName === "taskList") list = last;
    else {
      list = new Y.XmlElement("taskList");
      content.insert(content.length, [list]);
    }
    const items = lines.map((line) => {
      const found = parseWhen(line.replace(TASK_LINE, ""), now);
      const item = new Y.XmlElement("taskItem");
      // The same attributes the editor keeps on a to-do.
      const attrs: Record<string, unknown> = { checked: false, id: crypto.randomUUID().slice(0, 12), due: found.due, time: found.time, repeat: found.repeat, priority: found.priority || null };
      for (const [key, value] of Object.entries(attrs)) if (value !== null) item.setAttribute(key, value as string);
      const paragraph = new Y.XmlElement("paragraph");
      if (found.text) paragraph.insert(0, [new Y.XmlText(found.text)]);
      item.insert(0, [paragraph]);
      return item;
    });
    list.insert(list.length, items);
  });
  await note.close();

  const workspace = await openLocalDoc(store, WORKSPACE_DOC_ID, docOptions);
  try {
    const tree = readTree(workspace.doc);
    const inbox = tree.byId.get(INBOX_ID);
    if (!inbox) createNode(workspace.doc, "note", ROOT, "Inbox", INBOX_ID);
    else if (inbox.deletedAt !== null) restoreNode(workspace.doc, INBOX_ID);
  } finally {
    await workspace.close();
  }
  return INBOX_ID;
}
