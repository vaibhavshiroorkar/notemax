import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { KINDS, ROOT, canMove, createNode, readTree } from "../src";

describe("page kinds", () => {
  it("lets pages hold sub-pages, and books hold anything but folders", () => {
    expect(KINDS).toEqual(["folder", "book", "note", "board", "code"]);
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "F");
    const board = createNode(doc, "board", folder, "Sketch");
    const note = createNode(doc, "note", ROOT, "N");
    const book = createNode(doc, "book", ROOT, "B");
    const tree = readTree(doc);
    expect(tree.items.get(folder)!.children.map((c) => c.kind)).toEqual(["board"]);
    expect(canMove(tree, note, board)).toBeNull();
    expect(canMove(tree, board, book)).toBeNull();
    expect(canMove(tree, book, note)).toBeNull();
    expect(canMove(tree, folder, book)).toBe("a book cannot hold a folder");
    const sub = createNode(doc, "note", board, "Notes on the sketch");
    expect(readTree(doc).items.get(board)!.children.map((c) => c.id)).toEqual([sub]);
  });

  it("still reads a page of a kind that was removed, like the old mind maps", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "F");
    const old = createNode(doc, "note", folder, "Ideas");
    doc.getMap<Y.Map<unknown>>("nodes").get(old)!.set("kind", "mindmap");
    const tree = readTree(doc);
    expect(tree.byId.get(old)).toMatchObject({ kind: "mindmap", title: "Ideas", parentId: folder });
    expect(tree.items.get(folder)!.children.map((c) => c.id)).toEqual([old]);
    expect(() => createNode(doc, "note", old)).toThrow();
  });
});
