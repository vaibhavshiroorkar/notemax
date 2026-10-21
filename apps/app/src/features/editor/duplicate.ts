import * as Y from "yjs";
import { duplicateNote } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { getStore } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";

/** Copies a note and its body, then opens the copy. */
export async function duplicate(app: AppContext, id: string) {
  // Edits are saved in batches; the last few keystrokes may not be on disk yet.
  await peekDoc(id)?.flush();
  const store = await getStore();
  const { updates } = await store.load(id);
  const copyId = crypto.randomUUID();
  // The body goes first, so the copy never opens empty.
  if (updates.length) await store.append(copyId, Y.mergeUpdates(updates));
  duplicateNote(app.doc, id, copyId);
  app.open(copyId);
}
