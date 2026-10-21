import { useEffect, useState } from "react";
import { WORKSPACE_DOC_ID, ensureWelcome, readTree, type Tree } from "@notemax/core";
import { useLocalDoc } from "./useLocalDoc";

/** Opens the workspace tree doc and keeps a plain snapshot of it for rendering. */
export function useWorkspace() {
  const { local, status, openError } = useLocalDoc(WORKSPACE_DOC_ID);
  const [tree, setTree] = useState<Tree>();

  useEffect(() => {
    if (!local) return;
    ensureWelcome(local.doc);
    // Passing the last tree keeps unchanged items as the same objects, which is
    // what lets the sidebar skip rows a change did not touch.
    const refresh = () => setTree((previous) => readTree(local.doc, previous));
    refresh();
    local.doc.on("update", refresh);
    return () => local.doc.off("update", refresh);
  }, [local]);

  return { doc: local?.doc, tree: local ? tree : undefined, status, openError };
}
