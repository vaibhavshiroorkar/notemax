import type * as Y from "yjs";

// A board's drawing lives in its own document, like a note's text. Each
// Excalidraw element is one entry, keyed by its id, so two devices that change
// different shapes both keep their change. Deleted elements stay as entries
// marked isDeleted, which is how Excalidraw itself tells a delete from a shape
// the other side has not seen yet.

/** The fields this code reads. Everything else is kept as Excalidraw wrote it. */
export interface StoredElement {
  id: string;
  version: number;
  versionNonce: number;
  index?: string | null;
  [field: string]: unknown;
}

export interface StoredFile {
  id: string;
  mimeType: string;
  dataURL: string;
  created: number;
  [field: string]: unknown;
}

export const elementsOf = (doc: Y.Doc) => doc.getMap<StoredElement>("elements");
export const filesOf = (doc: Y.Doc) => doc.getMap<StoredFile>("files");

/** Edits made here, so the board does not apply its own writes back to itself. */
export const LOCAL = Symbol("board-local");

// Excalidraw changes element objects in place. A stored object must never be
// one Excalidraw holds, or a later edit would change it without being saved.
const copy = <T>(value: T): T => structuredClone(value);

/** The stored elements in drawing order, as copies Excalidraw may change. */
export function readElements(doc: Y.Doc): StoredElement[] {
  const elements = [...elementsOf(doc).values()].map(copy);
  // Excalidraw orders elements by a fractional `index`; the id breaks ties so every device agrees.
  return elements.sort((a, b) => {
    const ia = a.index ?? "";
    const ib = b.index ?? "";
    return ia < ib ? -1 : ia > ib ? 1 : a.id < b.id ? -1 : 1;
  });
}

/** Saves the elements that changed since they were stored. Returns how many. */
export function writeElements(doc: Y.Doc, elements: readonly StoredElement[]): number {
  const map = elementsOf(doc);
  const changed = elements.filter((element) => {
    const stored = map.get(element.id);
    return !stored || element.version > stored.version || (element.version === stored.version && element.versionNonce !== stored.versionNonce);
  });
  if (changed.length) doc.transact(() => changed.forEach((element) => map.set(element.id, copy(element))), LOCAL);
  return changed.length;
}

/** Saves pictures that are not stored yet. A picture never changes once added. */
export function writeFiles(doc: Y.Doc, files: Record<string, StoredFile>): number {
  const map = filesOf(doc);
  const added = Object.values(files).filter((file) => !map.has(file.id));
  if (added.length) doc.transact(() => added.forEach((file) => map.set(file.id, copy(file))), LOCAL);
  return added.length;
}

/** Stored pictures the board does not have yet. */
export function missingFiles(doc: Y.Doc, have: Record<string, unknown>): StoredFile[] {
  return [...filesOf(doc).values()].filter((file) => !(file.id in have)).map(copy);
}
