import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, WELCOME_ID, createNode, ensureWelcome, readTree, renameNode, restoreNode, trashNode } from "../src";

const titles = (items: { title: string }[]) => items.map((i) => i.title);

/** Copies every change each doc has that the other is missing, like two devices syncing. */
function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

/** Writes a node the way older versions did, bypassing createNode's checks. */
function writeRaw(doc: Y.Doc, id: string, fields: Record<string, unknown>) {
  const map = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>("nodes").set(id, map);
  for (const [key, value] of Object.entries({ title: id, position: "a0", createdAt: 0, deletedAt: null, ...fields })) map.set(key, value);
}

describe("workspace tree", () => {
  it("creates the welcome note once on a new workspace", () => {
    const doc = new Y.Doc();
    ensureWelcome(doc);
    ensureWelcome(doc);
    const tree = readTree(doc);
    expect(tree.top.map((n) => n.id)).toEqual([WELCOME_ID]);
    expect(tree.top[0].title).toBe("Welcome");
  });

  it("does not recreate the welcome note after it is trashed", () => {
    const doc = new Y.Doc();
    ensureWelcome(doc);
    trashNode(doc, WELCOME_ID);
    ensureWelcome(doc);
    expect(readTree(doc).top).toEqual([]);
  });

  it("keeps notes and folders in one top-level list, in creation order", () => {
    const doc = new Y.Doc();
    createNode(doc, "note", ROOT, "Loose idea");
    const folder = createNode(doc, "folder", ROOT, "Folder");
    createNode(doc, "note", folder, "Inside 1");
    const sub = createNode(doc, "folder", folder, "Subfolder");
    createNode(doc, "note", sub, "Deep");
    createNode(doc, "note", ROOT, "Another idea");

    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Loose idea", "Folder", "Another idea"]);
    expect(titles(tree.top[1].children)).toEqual(["Inside 1", "Subfolder"]);
    expect(titles(tree.top[1].children[1].children)).toEqual(["Deep"]);
  });

  it("refuses to put anything inside a note", () => {
    const doc = new Y.Doc();
    const note = createNode(doc, "note", ROOT, "Note");
    expect(() => createNode(doc, "note", note)).toThrow(/cannot hold/);
    expect(() => createNode(doc, "folder", note)).toThrow(/cannot hold/);
    expect(() => createNode(doc, "note", "no-such-folder")).toThrow(/no folder/);
  });

  it("lets a book hold notes only, and a folder hold books", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Writing");
    const book = createNode(doc, "book", folder, "My book");
    createNode(doc, "note", book, "Chapter 1");
    createNode(doc, "note", book, "Chapter 2");
    expect(() => createNode(doc, "folder", book)).toThrow(/cannot hold/);
    expect(() => createNode(doc, "book", book)).toThrow(/cannot hold/);

    const shelf = readTree(doc).top[0];
    expect(shelf.children[0].kind).toBe("book");
    expect(titles(shelf.children[0].children)).toEqual(["Chapter 1", "Chapter 2"]);
  });

  it("trash hides a folder and its contents, restore brings them back", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Folder");
    const note = createNode(doc, "note", folder, "Note");

    trashNode(doc, folder);
    let tree = readTree(doc);
    expect(tree.top).toEqual([]);
    expect(tree.visible.has(note)).toBe(false);
    expect(titles(tree.trash)).toEqual(["Folder"]);

    restoreNode(doc, folder);
    tree = readTree(doc);
    expect(titles(tree.top[0].children)).toEqual(["Note"]);
    expect(tree.trash).toEqual([]);
  });

  it("restoring a note whose folder is still trashed puts it at the top level", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Folder");
    const note = createNode(doc, "note", folder, "Note");
    trashNode(doc, note);
    trashNode(doc, folder);

    restoreNode(doc, note);
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Note"]);
    expect(tree.visible.has(note)).toBe(true);
  });

  it("merges a rename on one device with a trash on another", () => {
    const laptop = new Y.Doc();
    const id = createNode(laptop, "note", ROOT, "Draft");
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
    const folder = createNode(laptop, "folder", ROOT, "Folder");
    const phone = new Y.Doc();
    sync(laptop, phone);

    createNode(laptop, "note", folder, "From laptop");
    createNode(phone, "note", folder, "From phone");
    sync(laptop, phone);

    const order = titles(readTree(laptop).top[0].children);
    expect(order).toHaveLength(2);
    expect(titles(readTree(phone).top[0].children)).toEqual(order);
  });

  it("reads 5,000 notes quickly", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Big folder");
    for (let i = 0; i < 5000; i++) createNode(doc, "note", i % 2 ? folder : ROOT, `Note ${i}`);

    const start = performance.now();
    const tree = readTree(doc);
    const ms = performance.now() - start;
    console.log(`read tree of 5,000 notes: ${ms.toFixed(1)} ms`);

    expect(tree.visible.size).toBe(5001);
    expect(ms).toBeLessThan(100);
  });
});

describe("workspaces from before folders", () => {
  it("shows Inbox notes at the top level and keeps books", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "idea", { kind: "note", parentId: "inbox", position: "a0" });
    writeRaw(doc, "book", { kind: "book", parentId: "root", position: "a1" });
    writeRaw(doc, "chapter", { kind: "note", parentId: "book", position: "a0" });

    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["idea", "book"]);
    expect(tree.top[1].kind).toBe("book");
    expect(titles(tree.top[1].children)).toEqual(["chapter"]);
  });

  it("shows a note that was nested in a note inside the nearest book or folder", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "book", { kind: "book", parentId: "root" });
    writeRaw(doc, "chapter", { kind: "note", parentId: "book", position: "a0" });
    writeRaw(doc, "section", { kind: "note", parentId: "chapter", position: "a1" });
    writeRaw(doc, "loose", { kind: "note", parentId: "inbox", position: "a1" });
    writeRaw(doc, "under-loose", { kind: "note", parentId: "loose", position: "a2" });

    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["book", "loose", "under-loose"]);
    expect(titles(tree.top[0].children)).toEqual(["chapter", "section"]);
    expect(tree.items.get("chapter")!.children).toEqual([]);
  });

  it("hides such a note while the note above it is trashed", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "parent", { kind: "note", parentId: "inbox" });
    writeRaw(doc, "child", { kind: "note", parentId: "parent" });
    trashNode(doc, "parent");
    expect(readTree(doc).visible.has("child")).toBe(false);
  });

  it("shows a folder that was put in a book next to the book", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "book", { kind: "book", parentId: "root", position: "a0" });
    writeRaw(doc, "folder", { kind: "folder", parentId: "book", position: "a1" });
    writeRaw(doc, "chapter", { kind: "note", parentId: "book", position: "a0" });

    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["book", "folder"]);
    expect(titles(tree.top[0].children)).toEqual(["chapter"]);
  });

  it("allows new notes in an old book", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "book", { kind: "book", parentId: "root" });
    createNode(doc, "note", "book", "New chapter");
    expect(titles(readTree(doc).top[0].children)).toEqual(["New chapter"]);
  });
});
