import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { INBOX, ROOT, canMove, createNode, moveNode, readTree, trashNode } from "../src";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

function setup() {
  const doc = new Y.Doc();
  const book = createNode(doc, "book", ROOT, "Book");
  const other = createNode(doc, "book", ROOT, "Other book");
  const a = createNode(doc, "note", book, "A");
  const b = createNode(doc, "note", book, "B");
  const c = createNode(doc, "note", book, "C");
  const a1 = createNode(doc, "note", a, "A1");
  const idea = createNode(doc, "note", INBOX, "Idea");
  return { doc, book, other, a, b, c, a1, idea };
}

describe("moveNode", () => {
  it("reorders within the same parent", () => {
    const { doc, book, c } = setup();
    moveNode(doc, c, book, 0);
    expect(titles(readTree(doc).books[0].children)).toEqual(["C", "A", "B"]);
  });

  it("moves to the end and to the middle", () => {
    const { doc, book, a } = setup();
    moveNode(doc, a, book, 99);
    expect(titles(readTree(doc).books[0].children)).toEqual(["B", "C", "A"]);
    moveNode(doc, a, book, 1);
    expect(titles(readTree(doc).books[0].children)).toEqual(["B", "A", "C"]);
  });

  it("files an inbox note into a book, keeping its children", () => {
    const { doc, other, a, idea } = setup();
    moveNode(doc, a, INBOX, 0);
    let tree = readTree(doc);
    expect(titles(tree.inbox)).toEqual(["A", "Idea"]);
    expect(titles(tree.inbox[0].children)).toEqual(["A1"]);

    moveNode(doc, idea, other, 0);
    tree = readTree(doc);
    expect(titles(tree.inbox)).toEqual(["A"]);
    expect(titles(tree.books[1].children)).toEqual(["Idea"]);
  });

  it("nests a note inside another note", () => {
    const { doc, a, c } = setup();
    moveNode(doc, c, a, 0);
    expect(titles(readTree(doc).books[0].children[0].children)).toEqual(["C", "A1"]);
  });

  it("reorders books", () => {
    const { doc, other } = setup();
    moveNode(doc, other, ROOT, 0);
    expect(titles(readTree(doc).books)).toEqual(["Other book", "Book"]);
  });

  it("refuses moves that break the structure", () => {
    const { doc, book, other, a, a1, idea } = setup();
    const tree = readTree(doc);
    expect(canMove(tree, a, a)).toMatch(/inside itself/);
    expect(canMove(tree, a, a1)).toMatch(/inside itself/);
    expect(canMove(tree, book, other)).toMatch(/top level/);
    expect(canMove(tree, idea, ROOT)).toMatch(/inbox, a book/);
    expect(() => moveNode(doc, a, a1, 0)).toThrow();
    // Nothing changed after the refused move.
    expect(titles(readTree(doc).books[0].children[0].children)).toEqual(["A1"]);
  });

  it("refuses moving into a trashed note", () => {
    const { doc, a, b } = setup();
    trashNode(doc, b);
    expect(() => moveNode(doc, a, b, 0)).toThrow(/not in the tree/);
  });
});

describe("moves on two devices", () => {
  it("never loses notes when two devices make a loop", () => {
    const laptop = new Y.Doc();
    const book = createNode(laptop, "book", ROOT, "Book");
    const a = createNode(laptop, "note", book, "A");
    const b = createNode(laptop, "note", book, "B");
    const phone = new Y.Doc();
    sync(laptop, phone);

    moveNode(laptop, a, b, 0); // A into B
    moveNode(phone, b, a, 0); // B into A
    sync(laptop, phone);

    for (const doc of [laptop, phone]) {
      const tree = readTree(doc);
      expect(tree.visible.has(a) && tree.visible.has(b)).toBe(true);
      expect(tree.books[0].children).toEqual([]);
    }
    // Both devices show the same rescued shape in the inbox.
    const shape = (doc: Y.Doc) => JSON.stringify(readTree(doc).inbox.map((n) => [n.title, titles(n.children)]));
    expect(shape(laptop)).toBe(shape(phone));

    // A normal move afterwards repairs the stored data.
    const rescued = readTree(laptop).inbox[0];
    moveNode(laptop, rescued.id, book, 0);
    const tree = readTree(laptop);
    expect(tree.inbox).toEqual([]);
    expect(tree.books[0].children).toHaveLength(1);
    expect(tree.books[0].children[0].children).toHaveLength(1);
  });

  it("shows a note once when two devices move it to different places", () => {
    const laptop = new Y.Doc();
    const one = createNode(laptop, "book", ROOT, "One");
    const two = createNode(laptop, "book", ROOT, "Two");
    const note = createNode(laptop, "note", INBOX, "Note");
    const phone = new Y.Doc();
    sync(laptop, phone);

    moveNode(laptop, note, one, 0);
    moveNode(phone, note, two, 0);
    sync(laptop, phone);

    for (const doc of [laptop, phone]) {
      const tree = readTree(doc);
      const placements = tree.books.flatMap((book) => book.children).filter((n) => n.id === note);
      expect(placements).toHaveLength(1);
    }
    expect(readTree(laptop).byId.get(note)!.parentId).toBe(readTree(phone).byId.get(note)!.parentId);
  });
});
