import { useEffect } from "react";
import type * as Y from "yjs";
import { countWords, extractLinks, setLinks, setWords, touchNode } from "@notemax/core";

// How long typing must pause before links and words are recounted. There is
// no need to scan the body on every keystroke.
const SCAN_MS = 500;

/** Keeps the workspace's copy of this note's links, word count and edited time in step with its body. */
export function useBodyIndex(body: Y.Doc | undefined, workspaceDoc: Y.Doc, noteId: string) {
  useEffect(() => {
    if (!body) return;
    const fragment = body.getXmlFragment("content");
    const scan = () =>
      workspaceDoc.transact(() => {
        setLinks(workspaceDoc, noteId, extractLinks(fragment));
        setWords(workspaceDoc, noteId, countWords(fragment));
      });
    // Also on open, which repairs the list if it went stale, for example after
    // two devices edited this note at the same time.
    scan();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onUpdate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        workspaceDoc.transact(() => {
          scan();
          touchNode(workspaceDoc, noteId);
        });
      }, SCAN_MS);
    };
    body.on("update", onUpdate);
    return () => {
      body.off("update", onUpdate);
      // Switching notes must not drop a link typed in the last half second.
      if (timer) {
        clearTimeout(timer);
        scan();
      }
    };
  }, [body, workspaceDoc, noteId]);
}
