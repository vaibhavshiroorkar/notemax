import { useEffect, useState } from "react";
import { MAIN_WORKSPACE, WORKSPACE_DOC_ID, ensureStarter, watchTree, type LocalDoc, type Tree } from "@notemax/core";
import { useLocalDoc } from "./useLocalDoc";

/**
 * A new workspace starts empty, with a Welcome tab instead of pages (see
 * WelcomeView). Browser checks were written against starter pages, so on the
 * dev server, under automation, they still get them: only Welcome when they
 * ask for "bare", none when they ask for "empty". The built app has no such switch.
 */
function starterForChecks(): "bare" | "full" | null {
  if (!import.meta.env.DEV || !navigator.webdriver) return null;
  try {
    if (localStorage.getItem("notemax:checks:empty") === "1") return null;
    return localStorage.getItem("notemax:checks:bare") === "1" ? "bare" : "full";
  } catch {
    return null;
  }
}

/** Opens a workspace's tree doc and keeps a plain snapshot of it for rendering. */
export function useWorkspace(workspace: string) {
  const { local, status, openError } = useLocalDoc(WORKSPACE_DOC_ID, workspace);
  // Kept with the doc it was read from, so a switch never pairs one workspace's doc with another's tree.
  const [read, setRead] = useState<{ doc: LocalDoc["doc"]; tree: Tree }>();

  useEffect(() => {
    if (!local) return;
    const starter = workspace === MAIN_WORKSPACE ? starterForChecks() : null;
    if (starter) ensureStarter(local.doc, { welcomeOnly: starter === "bare" });
    // Unchanged items stay the same objects, which is what lets the sidebar
    // skip rows a change did not touch.
    return watchTree(local.doc, (tree) => setRead({ doc: local.doc, tree }));
  }, [local, workspace]);

  const tree = local && read?.doc === local.doc ? read.tree : undefined;
  return { doc: tree ? local?.doc : undefined, tree, status, openError };
}
