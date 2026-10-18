import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, createNode, deleteForever, descendantsOf, readTree, restoreNode, trashNode } from "../src";

describe("deleteForever", () => {
  it("refuses a node that is not in the trash", () => {
    const doc = new Y.Doc();
    const note = createNode(doc, "note", ROOT, "Keep me");
    expect(() => deleteForever(doc, note)).toThrow(/trash/);
    expect(readTree(doc).visible.has(note)).toBe(true);
  });

  it("erases a trashed folder and everything inside it", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "folder", ROOT, "Folder");
    const chapter = createNode(doc, "folder", book, "Subfolder");
    const section = createNode(doc, "note", chapter, "Note");
    const other = createNode(doc, "note", ROOT, "Other");
    trashNode(doc, book);

    expect(deleteForever(doc, book).sort()).toEqual([book, chapter, section].sort());
    const tree = readTree(doc);
    expect([...tree.byId.keys()]).toEqual([other]);
    expect(tree.trash).toHaveLength(0);
  });

  it("spares a child that was restored out of a trashed book", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "folder", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");
    trashNode(doc, chapter);
    trashNode(doc, book);
    restoreNode(doc, chapter);

    deleteForever(doc, book);
    expect(readTree(doc).top.map((n) => n.title)).toEqual(["Chapter"]);
  });

  it("finds descendants even when two devices made a loop", () => {
    const doc = new Y.Doc();
    const a = createNode(doc, "folder", ROOT, "A");
    const b = createNode(doc, "folder", a, "B");
    // Simulate the merged result of A moved into B on one device and B into A on another.
    doc.getMap<Y.Map<unknown>>("nodes").get(a)!.set("parentId", b);
    expect(descendantsOf(doc, a)).toEqual([b]);
  });
});
