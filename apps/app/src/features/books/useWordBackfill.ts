import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { countWords, setWords, type TreeNode } from "@notemax/core";
import { getStore } from "@/platform/platform";

/** Reads a chapter's words straight from storage. Nothing is written to the body. */
async function countStoredWords(id: string): Promise<number> {
  const { updates } = await (await getStore()).load(id);
  const body = new Y.Doc();
  try {
    if (updates.length) Y.applyUpdate(body, Y.mergeUpdates(updates));
    return countWords(body.getXmlFragment("content"));
  } finally {
    body.destroy();
  }
}

/**
 * Counts chapters that have not been opened since word counts were added. Each
 * is counted once per visit to the page, even as other counts arrive and the
 * list re-renders.
 */
export function useWordBackfill(chapters: TreeNode[], workspaceDoc: Y.Doc) {
  const requested = useRef(new Set<string>());
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => void (live.current = false);
  }, []);

  const uncounted = chapters.filter((chapter) => chapter.words === null).map((chapter) => chapter.id);
  const key = uncounted.join(",");
  useEffect(() => {
    for (const id of key ? key.split(",") : []) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      countStoredWords(id)
        .then((words) => {
          // Once the page is closed the chapter may be open in the editor,
          // which keeps its own count. An older count must not replace it.
          if (live.current) setWords(workspaceDoc, id, words);
        })
        .catch((err) => console.warn("[notemax] could not count words", id, err));
    }
  }, [key, workspaceDoc]);
}
