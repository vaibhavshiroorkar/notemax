import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  INBOX,
  ROOT,
  WELCOME_ID,
  createNode,
  ensureWelcome,
  readTree,
  renameNode,
  restoreNode,
  trashNode,
} from "../src";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

/** Copies every change each doc has that the other is missing, like two devices syncing. */
function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

describe("workspace tree", () => {
  it("creates the welcome note once on a new workspace", () => {
    const doc = new Y.Doc();
    ensureWelcome(doc);
    ensureWelcome(doc);
    const tree = readTree(doc);
    expect(tree.inbox.map((n) => n.id)).toEqual([WELCOME_ID]);
    expect(tree.inbox[0].title).toBe("Welcome");
  });

  it("does not recreate the welcome note after it is trashed", () => {
    const doc = new Y.Doc();
    ensureWelcome(doc);
    trashNode(doc, WELCOME_ID);
    ensureWelcome(doc);
    expect(readTree(doc).inbox).toEqual([]);
  });

  it("keeps creation order and nests notes in books and in other notes", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const ch1 = createNode(doc, "note", book, "Chapter 1");
    createNode(doc, "note", book, "Chapter 2");
    createNode(doc, "note", ch1, "Section 1.1");
    createNode(doc, "note", INBOX, "Loose idea");

    const tree = readTree(doc);
    expect(titles(tree.books)).toEqual(["Book"]);
    expect(titles(tree.books[0].children)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(titles(tree.books[0].children[0].children)).toEqual(["Section 1.1"]);
    expect(titles(tree.inbox)).toEqual(["Loose idea"]);
  });

  it("rejects books inside books and notes at the top level", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    expect(() => createNode(doc, "book", book)).toThrow();
    expect(() => createNode(doc, "note", ROOT)).toThrow();
  });

  it("trash hides a node and its children, restore brings them back", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");

    trashNode(doc, book);
    let tree = readTree(doc);
    expect(tree.books).toEqual([]);
    expect(tree.visible.has(chapter)).toBe(false);
    expect(titles(tree.trash)).toEqual(["Book"]);

    restoreNode(doc, book);
    tree = readTree(doc);
    expect(titles(tree.books[0].children)).toEqual(["Chapter"]);
    expect(tree.trash).toEqual([]);
  });

  it("restoring a note whose book is still trashed moves it to the inbox", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");
    trashNode(doc, chapter);
    trashNode(doc, book);

    restoreNode(doc, chapter);
    const tree = readTree(doc);
    expect(titles(tree.inbox)).toEqual(["Chapter"]);
    expect(tree.visible.has(chapter)).toBe(true);
  });

  it("merges a rename on one device with a trash on another", () => {
    const laptop = new Y.Doc();
    const id = createNode(laptop, "note", INBOX, "Draft");
    const phone = new Y.Doc();
    sync(laptop, phone);

    renameNode(laptop, id, "Final title");
    trashNode(phone, id);
    sync(laptop, phone);

    for (const doc of [laptop, phone]) {
      const node = readTree(doc).byId.get(id)!;
      expect(node.title).toBe("Final title");
      expect(node.deletedAt).not.toBeNull();
    }
  });

  it("shows the same order on both devices when both add a note at the same time", () => {
    const laptop = new Y.Doc();
    const book = createNode(laptop, "book", ROOT, "Book");
    const phone = new Y.Doc();
    sync(laptop, phone);

    createNode(laptop, "note", book, "From laptop");
    createNode(phone, "note", book, "From phone");
    sync(laptop, phone);

    const order = titles(readTree(laptop).books[0].children);
    expect(order).toHaveLength(2);
    expect(titles(readTree(phone).books[0].children)).toEqual(order);
  });

  it("reads 5,000 notes quickly", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Big book");
    for (let i = 0; i < 5000; i++) createNode(doc, "note", i % 2 ? book : INBOX, `Note ${i}`);

    const start = performance.now();
    const tree = readTree(doc);
    const ms = performance.now() - start;
    console.log(`read tree of 5,000 notes: ${ms.toFixed(1)} ms`);

    expect(tree.visible.size).toBe(5001);
    expect(ms).toBeLessThan(100);
  });
});
