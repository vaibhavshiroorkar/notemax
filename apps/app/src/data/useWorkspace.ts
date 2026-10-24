import { useEffect, useState } from "react";
import { MAIN_WORKSPACE, WORKSPACE_DOC_ID, ensureStarter, watchTree, type Tree } from "@notemax/core";
import { currentWorkspace } from "@/platform/prefs";
import { useLocalDoc } from "./useLocalDoc";

/**
 * Browser checks written before the starter pages expect a workspace with
 * only Welcome. On the dev server they can ask for that; the built app has no
 * such switch.
 */
function bareForChecks(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem("notemax:checks:bare") === "1";
  } catch {
    return false;
  }
}

/** Opens the workspace tree doc and keeps a plain snapshot of it for rendering. */
export function useWorkspace() {
  const { local, status, openError } = useLocalDoc(WORKSPACE_DOC_ID);
  const [tree, setTree] = useState<Tree>();

  useEffect(() => {
    if (!local) return;
    // Only the first workspace gets the starter pages. A new one starts empty.
    if (currentWorkspace === MAIN_WORKSPACE) ensureStarter(local.doc, { welcomeOnly: bareForChecks() });
    // Unchanged items stay the same objects, which is what lets the sidebar
    // skip rows a change did not touch.
    return watchTree(local.doc, setTree);
  }, [local]);

  return { doc: local?.doc, tree: local ? tree : undefined, status, openError };
}
