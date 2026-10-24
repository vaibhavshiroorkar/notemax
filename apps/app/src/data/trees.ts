import { WORKSPACE_DOC_ID, watchTree, type Tree } from "@notemax/core";
import { createStore } from "@/platform/store";
import { acquireDoc } from "./docCache";

// Trees of workspaces other than the shown one, for tabs that hold their
// pages: a tab's title comes from its own workspace. Each opens on first ask
// and stays open; a person has a handful of workspaces at most.

const trees = new Map<string, Tree | null>();

/** Bumps whenever one of these trees changes, so tab titles can redraw. */
export const treesVersion = createStore(0);

/** A workspace's tree, or null while it opens. */
export function treeIn(workspace: string): Tree | null {
  if (!trees.has(workspace)) {
    trees.set(workspace, null);
    void acquireDoc(WORKSPACE_DOC_ID, workspace).then(
      (local) =>
        watchTree(local.doc, (tree) => {
          trees.set(workspace, tree);
          treesVersion.set(treesVersion.get() + 1);
        }),
      // A workspace that cannot open, like one deleted on another device, shows its tabs as gone.
      () => undefined,
    );
  }
  return trees.get(workspace) ?? null;
}
