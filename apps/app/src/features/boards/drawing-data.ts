import type { StoredElement, StoredFile } from "./board-sync";

// A drawing in a note keeps its shapes in the note itself, as JSON text in the
// block's attributes. So copying the block, duplicating the note, templates,
// version history and the Markdown mirror all carry the drawing with no extra
// work. Text, not arrays: attributes compare by value only when they are text.

export const HEIGHTS = { S: 240, M: 360, L: 560 } as const;
export const DEFAULT_HEIGHT = HEIGHTS.M;

export function readList(json: unknown): StoredElement[] {
  try {
    const value = JSON.parse(typeof json === "string" ? json : "[]") as unknown;
    return Array.isArray(value) ? (value as StoredElement[]) : [];
  } catch {
    return [];
  }
}

export function readFiles(json: unknown): Record<string, StoredFile> {
  try {
    const value = JSON.parse(typeof json === "string" ? json : "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, StoredFile>) : {};
  } catch {
    return {};
  }
}

/** Whether a drawing has anything on it. */
export const hasShapes = (elements: readonly StoredElement[]) => elements.some((element) => !element.isDeleted);

// Deleted shapes are kept a while so another device that still shows one
// learns it went, instead of drawing it back. After a day they only take room.
const KEEP_DELETED_MS = 24 * 60 * 60 * 1000;

/** The scene as stored: long-deleted shapes and pictures nothing shows are left out. */
export function packScene(elements: readonly StoredElement[], files: Record<string, StoredFile>, now = Date.now()) {
  const kept = elements.filter((element) => !element.isDeleted || now - Number(element.updated ?? now) < KEEP_DELETED_MS);
  const used = new Set(kept.filter((element) => !element.isDeleted).map((element) => element.fileId));
  const keptFiles = Object.fromEntries(Object.entries(files).filter(([id]) => used.has(id)));
  return { elements: JSON.stringify(kept), files: JSON.stringify(keptFiles) };
}

// The / menu opens the new drawing for drawing right away. The flag lives a
// moment, not until read: React may mount the view twice in development.
let openUntil = 0;
export const openNextDrawing = () => {
  openUntil = Date.now() + 1500;
};
export const shouldOpenNew = () => Date.now() < openUntil;
