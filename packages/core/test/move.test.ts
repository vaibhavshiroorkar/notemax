import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, canMove, createNode, moveNode, moveNodes, readTree, trashNode } from "../src";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

function setup() {
  const doc = new Y.Doc();
  const folder = createNode(doc, "folder", ROOT, "Folder");
  const other = createNode(doc, "folder", ROOT, "Other");
  const a = createNode(doc, "note", folder, "A");
  const b = createNode(doc, "note", folder, "B");
  const c = createNode(doc, "note", folder, "C");
  const sub = createNode(doc, "folder", folder, "Sub");
  const idea = createNode(doc, "note", ROOT, "Idea");
  return { doc, folder, other, a, b, c, sub, idea };
}

describe("moveNode", () => {
  it("reorders within the same folder", () => {
    const { doc, folder, c } = setup();
    moveNode(doc, c, folder, 0);
    expect(titles(readTree(doc).top[0].children)).toEqual(["C", "A", "B", "Sub"]);
  });

  it("moves to the end and to the middle", () => {
    const { doc, folder, a } = setup();
    moveNode(doc, a, folder, 99);
    expect(titles(readTree(doc).top[0].children)).toEqual(["B", "C", "Sub", "A"]);
    moveNode(doc, a, folder, 1);
    expect(titles(readTree(doc).top[0].children)).toEqual(["B", "A", "C", "Sub"]);
  });

  it("moves notes into a folder and back out to the top level", () => {
    const { doc, other, a, idea } = setup();
    moveNode(doc, idea, other, 0);
    let tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Folder", "Other"]);
    expect(titles(tree.top[1].children)).toEqual(["Idea"]);

    moveNode(doc, a, ROOT, 0);
    tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["A", "Folder", "Other"]);
  });

  it("mixes notes and folders at the top level", () => {
    const { doc, other, idea } = setup();
    moveNode(doc, idea, ROOT, 0);
    moveNode(doc, other, ROOT, 1);
    expect(titles(readTree(doc).top)).toEqual(["Idea", "Other", "Folder"]);
  });

  it("puts a folder inside another folder, with its contents", () => {
    const { doc, folder, other, sub, b } = setup();
    moveNode(doc, b, sub, 0);
    moveNode(doc, sub, other, 0);
    const tree = readTree(doc);
    expect(titles(tree.top[0].children)).toEqual(["A", "C"]);
    expect(titles(tree.top[1].children)).toEqual(["Sub"]);
    expect(titles(tree.top[1].children[0].children)).toEqual(["B"]);
    expect(tree.items.get(sub)!.parentId).toBe(other);
    expect(folder).toBeTruthy();
  });

  it("refuses moves that break the structure", () => {
    const { doc, folder, a, b, sub } = setup();
    const tree = readTree(doc);
    expect(canMove(tree, folder, folder)).toMatch(/inside itself/);
    expect(canMove(tree, folder, sub)).toMatch(/inside itself/);
    expect(canMove(tree, a, a)).toMatch(/inside itself/);
    expect(() => moveNode(doc, folder, sub, 0)).toThrow();
    // Nothing changed after the refused move.
    expect(readTree(doc).items.get(sub)!.parentId).toBe(folder);
  });

  it("moves notes into a book, and the book into a folder", () => {
    const { doc, other, a, idea } = setup();
    const book = createNode(doc, "book", ROOT, "Book");
    moveNode(doc, a, book, 0);
    moveNode(doc, idea, book, 0);
    moveNode(doc, book, other, 0);
    const tree = readTree(doc);
    expect(titles(tree.top[1].children)).toEqual(["Book"]);
    expect(titles(tree.top[1].children[0].children)).toEqual(["Idea", "A"]);
  });

  it("keeps folders and books out of books", () => {
    const { doc, folder, sub } = setup();
    const book = createNode(doc, "book", ROOT, "Book");
    const other = createNode(doc, "book", ROOT, "Other book");
    const tree = readTree(doc);
    expect(canMove(tree, sub, book)).toMatch(/cannot hold a folder/);
    expect(canMove(tree, other, book)).toMatch(/cannot hold a book/);
    expect(canMove(tree, book, folder)).toBeNull();
  });

  it("keeps books out of chapters, including books inside a moved note", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");
    const note = createNode(doc, "note", ROOT, "Note");
    const nested = createNode(doc, "book", note, "Other book");
    const tree = readTree(doc);
    expect(() => createNode(doc, "book", chapter)).toThrow(/cannot hold a book/);
    expect(canMove(tree, nested, chapter)).toMatch(/cannot hold a book/);
    expect(canMove(tree, note, book)).toMatch(/cannot hold a book/);
    expect(canMove(tree, note, chapter)).toMatch(/cannot hold a book/);
  });

  it("keeps folders out of chapters, and shows an old one beside its book", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");
    const folder = createNode(doc, "folder", ROOT, "Folder");
    expect(() => createNode(doc, "folder", chapter)).toThrow(/cannot hold a folder/);
    expect(canMove(readTree(doc), folder, chapter)).toMatch(/cannot hold a folder/);
    // Written before the rule, straight into the data.
    doc.getMap<Y.Map<unknown>>("nodes").get(folder)!.set("parentId", chapter);
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Book", "Folder"]);
    expect(tree.items.get(chapter)!.children).toEqual([]);
  });

  it("refuses moving into a trashed folder", () => {
    const { doc, a, other } = setup();
    trashNode(doc, other);
    expect(() => moveNode(doc, a, other, 0)).toThrow(/not in the tree/);
  });
});

describe("moves on two devices", () => {
  it("never loses folders when two devices make a loop", () => {
    const laptop = new Y.Doc();
    const a = createNode(laptop, "folder", ROOT, "A");
    const b = createNode(laptop, "folder", ROOT, "B");
    createNode(laptop, "note", a, "In A");
    const phone = new Y.Doc();
    sync(laptop, phone);

    moveNode(laptop, a, b, 0); // A into B
    moveNode(phone, b, a, 0); // B into A
    sync(laptop, phone);

    for (const doc of [laptop, phone]) {
      const tree = readTree(doc);
      expect(tree.visible.has(a) && tree.visible.has(b)).toBe(true);
      expect(tree.visible.size).toBe(3);
    }
    // Both devices show the same rescued shape at the top level.
    const shape = (doc: Y.Doc) => JSON.stringify(readTree(doc).top.map((n) => [n.title, titles(n.children)]));
    expect(shape(laptop)).toBe(shape(phone));

    // A normal move afterwards repairs the stored data.
    const rescued = readTree(laptop).top[0];
    moveNode(laptop, rescued.id, ROOT, 0);
    const tree = readTree(laptop);
    expect(tree.top).toHaveLength(1);
    expect(tree.top[0].children.some((n) => n.kind === "folder")).toBe(true);
  });

  it("shows a note once when two devices move it to different folders", () => {
    const laptop = new Y.Doc();
    const one = createNode(laptop, "folder", ROOT, "One");
    const two = createNode(laptop, "folder", ROOT, "Two");
    const note = createNode(laptop, "note", ROOT, "Note");
    const phone = new Y.Doc();
    sync(laptop, phone);

    moveNode(laptop, note, one, 0);
    moveNode(phone, note, two, 0);
    sync(laptop, phone);

    for (const doc of [laptop, phone]) {
      const tree = readTree(doc);
      const placements = tree.top.flatMap((folder) => folder.children).filter((n) => n.id === note);
      expect(placements).toHaveLength(1);
    }
    expect(readTree(laptop).byId.get(note)!.parentId).toBe(readTree(phone).byId.get(note)!.parentId);
  });
});

describe("moveNodes", () => {
  it("moves several pages together, in the order given, before a sibling", () => {
    const { doc, folder, other, a, c, idea } = setup();
    moveNodes(doc, [c, a], other, null);
    expect(titles(readTree(doc).top[1].children)).toEqual(["C", "A"]);
    moveNodes(doc, [idea], other, a);
    expect(titles(readTree(doc).top[1].children)).toEqual(["C", "Idea", "A"]);
    expect(titles(readTree(doc).top[0].children)).toEqual(["B", "Sub"]);
    void folder;
  });

  it("reorders inside one folder, even when the target is one of the moved", () => {
    const { doc, folder, a, b, c, sub } = setup();
    // Drop A and C just before B: they land there, B follows.
    moveNodes(doc, [a, c], folder, b);
    expect(titles(readTree(doc).top[0].children)).toEqual(["A", "C", "B", "Sub"]);
    // A target that is itself moving means the next sibling that is not.
    moveNodes(doc, [sub, b], folder, sub);
    expect(titles(readTree(doc).top[0].children)).toEqual(["A", "C", "Sub", "B"]);
  });

  it("leaves a page that is inside a moved folder where it is, inside that folder", () => {
    const { doc, folder, other, a } = setup();
    moveNodes(doc, [folder, a], other, null);
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Other", "Idea"]);
    expect(titles(tree.top[0].children)).toEqual(["Folder"]);
    expect(titles(tree.top[0].children[0].children)).toEqual(["A", "B", "C", "Sub"]);
  });

  it("skips what cannot go there, like a folder into itself", () => {
    const { doc, folder, sub, idea } = setup();
    moveNodes(doc, [folder, idea], sub, null);
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Folder", "Other"]);
    expect(titles(tree.items.get(sub)!.children)).toEqual(["Idea"]);
  });
});
