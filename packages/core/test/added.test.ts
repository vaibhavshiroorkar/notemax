import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, createNode, onNodesAdded, renameNode } from "../src/index";

describe("onNodesAdded", () => {
  it("reports pages made here, not edits or pages merged in", () => {
    const here = new Y.Doc();
    const there = new Y.Doc();
    const seen: string[][] = [];
    const stop = onNodesAdded(here, (ids) => seen.push(ids));

    const mine = createNode(here, "note", ROOT, "Mine");
    renameNode(here, mine, "Still mine");
    const theirs = createNode(there, "note", ROOT, "Theirs");
    Y.applyUpdate(here, Y.encodeStateAsUpdate(there));
    expect(seen).toEqual([[mine]]);
    expect(theirs).not.toBe(mine);

    stop();
    createNode(here, "folder", ROOT);
    expect(seen).toHaveLength(1);
  });
});
