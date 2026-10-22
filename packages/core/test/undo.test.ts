import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, createNode, readTree, renameNode, setLinks, setWords, trashNode, treeUndo } from "../src/index";

describe("treeUndo", () => {
  it("undoes and redoes this device's changes to the tree", () => {
    const doc = new Y.Doc();
    const undo = treeUndo(doc);
    const id = createNode(doc, "note", ROOT, "Draft");
    undo.stopCapturing();
    renameNode(doc, id, "Final");
    undo.stopCapturing();
    trashNode(doc, id);

    undo.undo();
    expect(readTree(doc).byId.get(id)!.deletedAt).toBeNull();
    undo.undo();
    expect(readTree(doc).byId.get(id)!.title).toBe("Draft");
    undo.redo();
    expect(readTree(doc).byId.get(id)!.title).toBe("Final");
  });

  it("skips word counts, links and edits from other devices", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "Note");
    const undo = treeUndo(doc);
    setWords(doc, id, 12);
    setLinks(doc, id, ["other"]);
    const there = new Y.Doc();
    Y.applyUpdate(there, Y.encodeStateAsUpdate(doc));
    renameNode(there, id, "Renamed elsewhere");
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(there), "remote");

    expect(undo.undoStack).toHaveLength(0);
    const node = readTree(doc).byId.get(id)!;
    expect([node.words, node.links, node.title]).toEqual([12, ["other"], "Renamed elsewhere"]);
  });
});
