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
    const refresh = () => setTree(readTree(local.doc));
    refresh();
    local.doc.on("update", refresh);
    return () => local.doc.off("update", refresh);
  }, [local]);

  return { doc: local?.doc, tree: local ? tree : undefined, status, openError };
}
