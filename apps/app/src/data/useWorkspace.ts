import { useEffect, useState } from "react";
import { MAIN_WORKSPACE, WORKSPACE_DOC_ID, ensureStarter, watchTree, type LocalDoc, type Tree } from "@notemax/core";
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

/** Opens a workspace's tree doc and keeps a plain snapshot of it for rendering. */
export function useWorkspace(workspace: string) {
  const { local, status, openError } = useLocalDoc(WORKSPACE_DOC_ID, workspace);
  // Kept with the doc it was read from, so a switch never pairs one workspace's doc with another's tree.
  const [read, setRead] = useState<{ doc: LocalDoc["doc"]; tree: Tree }>();

  useEffect(() => {
    if (!local) return;
    // Only the first workspace gets the starter pages. A new one starts empty.
    if (workspace === MAIN_WORKSPACE) ensureStarter(local.doc, { welcomeOnly: bareForChecks() });
    // Unchanged items stay the same objects, which is what lets the sidebar
    // skip rows a change did not touch.
    return watchTree(local.doc, (tree) => setRead({ doc: local.doc, tree }));
  }, [local, workspace]);

  const tree = local && read?.doc === local.doc ? read.tree : undefined;
  return { doc: tree ? local?.doc : undefined, tree, status, openError };
}
