import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, STARTER, WELCOME_ID, addTag, createNode, duplicateNote, ensureStarter, moveNode, readTree, renameNode, restoreNode, setKind, setProp, setWords, trashNode, watchTree } from "../src";

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
  it("starts a new workspace once with Welcome, Journal, a board and a small book", () => {
    const doc = new Y.Doc();
    ensureStarter(doc);
    ensureStarter(doc);
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["Welcome", "Journal", "Drawing board", "My first book"]);
    expect(tree.top.map((n) => n.kind)).toEqual(["note", "note", "board", "book"]);
    const journal = tree.items.get(STARTER.journal)!;
    expect(journal.props.dailyFolder).toBe(true);
    expect(journal.props.subtopics).toBe("inline");
    expect(journal.props.sort).toBe("days");
    const book = tree.items.get(STARTER.book)!;
    expect(titles(book.children)).toEqual(["Getting started"]);
    expect(titles(book.children[0].children)).toEqual(["A subtopic"]);
  });

  it("makes one starter set when two new devices sync", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    ensureStarter(a);
    ensureStarter(b);
    sync(a, b);
    expect(titles(readTree(a).top)).toEqual(["Welcome", "Journal", "Drawing board", "My first book"]);
    expect(readTree(a).byId.size).toBe(6);
  });

  it("does not bring the starter pages back after they are trashed", () => {
    const doc = new Y.Doc();
    ensureStarter(doc);
    for (const id of Object.values(STARTER)) trashNode(doc, id);
    ensureStarter(doc);
    expect(readTree(doc).top).toEqual([]);
  });

  it("sorts a folder's pages the way the folder says, and books never", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Journal");
    for (const title of ["2026-10-10", "2026-09-30", "2026-10-02"]) createNode(doc, "note", folder, title);
    const order = () => titles(readTree(doc).items.get(folder)!.children);
    expect(order()).toEqual(["2026-10-10", "2026-09-30", "2026-10-02"]);
    setProp(doc, folder, "sort", "title");
    expect(order()).toEqual(["2026-09-30", "2026-10-02", "2026-10-10"]);
    setProp(doc, folder, "sort", "title-desc");
    expect(order()).toEqual(["2026-10-10", "2026-10-02", "2026-09-30"]);
    const numbered = createNode(doc, "folder", ROOT, "Days");
    for (const title of ["Day 10", "Day 2", "day 1"]) createNode(doc, "note", numbered, title);
    setProp(doc, numbered, "sort", "title");
    expect(titles(readTree(doc).items.get(numbered)!.children)).toEqual(["day 1", "Day 2", "Day 10"]);
    const book = createNode(doc, "book", ROOT, "Book");
    createNode(doc, "note", book, "B");
    createNode(doc, "note", book, "A");
    setProp(doc, book, "sort", "title");
    expect(titles(readTree(doc).items.get(book)!.children)).toEqual(["B", "A"]);
  });

  it("puts the newest day first with the days sort, then pages with no day", () => {
    const doc = new Y.Doc();
    const journal = createNode(doc, "note", ROOT, "Journal");
    setProp(doc, journal, "sort", "days");
    const day = (key: string, title: string, prop = "daily") => setProp(doc, createNode(doc, "note", journal, title), prop, key);
    day("2026-10-02", "2 Oct 2026");
    day("2026-10-10", "10 Oct 2026");
    createNode(doc, "note", journal, "No day");
    day("2026-09-30", "Dated page", "date");
    expect(titles(readTree(doc).items.get(journal)!.children)).toEqual(["10 Oct 2026", "2 Oct 2026", "Dated page", "No day"]);
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

  it("puts sub-pages, even folders, inside a note", () => {
    const doc = new Y.Doc();
    const note = createNode(doc, "note", ROOT, "Note");
    createNode(doc, "note", note, "Sub-page");
    createNode(doc, "folder", note, "Attachments");
    expect(titles(readTree(doc).top[0].children)).toEqual(["Sub-page", "Attachments"]);
    expect(() => createNode(doc, "note", "no-such-folder")).toThrow(/no page or folder/);
  });

  it("lets a book hold notes and boards but no books or folders", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Writing");
    const book = createNode(doc, "book", folder, "My book");
    createNode(doc, "note", book, "Chapter 1");
    createNode(doc, "note", book, "Chapter 2");
    expect(() => createNode(doc, "folder", book)).toThrow(/cannot hold/);
    expect(() => createNode(doc, "book", book)).toThrow(/cannot hold/);
    createNode(doc, "board", book, "Map");
    const other = createNode(doc, "book", folder, "Other book");
    expect(() => moveNode(doc, other, book, 0)).toThrow(/cannot hold/);

    const shelf = readTree(doc).top[0];
    expect(shelf.children[0].kind).toBe("book");
    expect(titles(shelf.children[0].children)).toEqual(["Chapter 1", "Chapter 2", "Map"]);
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
  it("shows an old nested book beside its parent without rewriting or losing its contents", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "shelf", { kind: "folder", parentId: ROOT });
    writeRaw(doc, "book", { kind: "book", parentId: "shelf" });
    writeRaw(doc, "part", { kind: "book", parentId: "book", position: "a1" });
    writeRaw(doc, "chapter", { kind: "note", parentId: "part" });

    const tree = readTree(doc);
    expect(titles(tree.items.get("shelf")!.children)).toEqual(["book", "part"]);
    expect(titles(tree.items.get("part")!.children)).toEqual(["chapter"]);
    expect(tree.byId.get("part")!.parentId).toBe("book");
    expect(tree.items.get("part")!.parentId).toBe("shelf");
  });

  it("also lifts an old book out of a chapter", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "book", { kind: "book", parentId: ROOT });
    writeRaw(doc, "chapter", { kind: "note", parentId: "book" });
    writeRaw(doc, "nested", { kind: "book", parentId: "chapter", position: "a1" });
    writeRaw(doc, "text", { kind: "note", parentId: "nested" });
    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["book", "nested"]);
    expect(titles(tree.items.get("nested")!.children)).toEqual(["text"]);
    expect(tree.items.get("chapter")!.children).toEqual([]);
  });

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

  it("shows a note that was nested in a note under that note, now that notes hold pages", () => {
    const doc = new Y.Doc();
    writeRaw(doc, "book", { kind: "book", parentId: "root" });
    writeRaw(doc, "chapter", { kind: "note", parentId: "book", position: "a0" });
    writeRaw(doc, "section", { kind: "note", parentId: "chapter", position: "a1" });
    writeRaw(doc, "loose", { kind: "note", parentId: "inbox", position: "a1" });
    writeRaw(doc, "under-loose", { kind: "note", parentId: "loose", position: "a2" });

    const tree = readTree(doc);
    expect(titles(tree.top)).toEqual(["book", "loose"]);
    expect(titles(tree.top[0].children)).toEqual(["chapter"]);
    expect(titles(tree.items.get("chapter")!.children)).toEqual(["section"]);
    expect(titles(tree.items.get("loose")!.children)).toEqual(["under-loose"]);
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

describe("reading the tree again", () => {
  function setup() {
    const doc = new Y.Doc();
    const a = createNode(doc, "folder", ROOT, "A");
    const b = createNode(doc, "folder", ROOT, "B");
    const a1 = createNode(doc, "note", a, "a1");
    const a2 = createNode(doc, "note", a, "a2");
    const b1 = createNode(doc, "note", b, "b1");
    return { doc, a, b, a1, a2, b1, tree: readTree(doc) };
  }

  it("follows changes when watched, reading only what changed", () => {
    const { doc, a, a1, a2, b1 } = setup();
    const trees: ReturnType<typeof readTree>[] = [];
    const stop = watchTree(doc, (tree) => trees.push(tree));
    renameNode(doc, a1, "a1 renamed");
    const c = createNode(doc, "note", ROOT, "c");
    trashNode(doc, b1);
    moveNode(doc, a2, ROOT, 0);
    const full = readTree(doc);
    stop();
    renameNode(doc, a2, "not seen");
    const [first, renamed, added, trashed, moved] = trees;
    expect(trees).toHaveLength(5);
    expect(renamed.byId.get(a1)!.title).toBe("a1 renamed");
    expect(renamed.byId.get(a2)).toBe(first.byId.get(a2));
    expect(added.byId.get(c)!.title).toBe("c");
    expect(trashed.trash.map((n) => n.id)).toEqual([b1]);
    expect(titles(moved.items.get(a)!.children)).toEqual(["a1 renamed"]);
    expect(JSON.stringify(moved.top)).toBe(JSON.stringify(full.top));
  });

  it("returns the same objects when nothing changed", () => {
    const { doc, tree } = setup();
    const again = readTree(doc, tree);
    expect(again.top).toBe(tree.top);
    for (const [id, item] of tree.items) expect(again.items.get(id)).toBe(item);
    for (const [id, node] of tree.byId) expect(again.byId.get(id)).toBe(node);
  });

  it("replaces only the changed item and the items above it", () => {
    const { doc, a, b, a1, a2, b1, tree } = setup();
    renameNode(doc, a1, "a1 renamed");
    const again = readTree(doc, tree);
    expect(again.items.get(a1)).not.toBe(tree.items.get(a1));
    expect(again.items.get(a1)!.title).toBe("a1 renamed");
    expect(again.items.get(a)).not.toBe(tree.items.get(a));
    expect(again.top).not.toBe(tree.top);
    expect(again.items.get(a2)).toBe(tree.items.get(a2));
    expect(again.items.get(b)).toBe(tree.items.get(b));
    expect(again.items.get(b1)).toBe(tree.items.get(b1));
  });

  it("sees changes to words, tags, moves and the trash", () => {
    const { doc, a, b, a1, b1, tree } = setup();
    setWords(doc, b1, 12);
    let again = readTree(doc, tree);
    expect(again.items.get(b1)!.words).toBe(12);
    expect(again.items.get(b)).not.toBe(tree.items.get(b));
    expect(again.items.get(a)).toBe(tree.items.get(a));

    const before = again;
    addTag(doc, a1, "poetry");
    again = readTree(doc, before);
    expect(again.items.get(a1)!.tags).toEqual(["poetry"]);
    expect(again.items.get(a1)).not.toBe(before.items.get(a1));

    const beforeMove = again;
    moveNode(doc, a1, b, 0);
    again = readTree(doc, beforeMove);
    expect(titles(again.items.get(a)!.children)).toEqual(["a2"]);
    expect(titles(again.items.get(b)!.children)).toEqual(["a1", "b1"]);
    expect(again.items.get(b1)).toBe(beforeMove.items.get(b1));

    const beforeTrash = again;
    trashNode(doc, b1);
    again = readTree(doc, beforeTrash);
    expect(titles(again.items.get(b)!.children)).toEqual(["a1"]);
    expect(again.trash.map((n) => n.id)).toEqual([b1]);
  });

  it("gives the same tree as reading from scratch", () => {
    const { doc, a1, b, tree } = setup();
    renameNode(doc, a1, "x");
    moveNode(doc, a1, b, 1);
    const plain = (t: ReturnType<typeof readTree>) => JSON.stringify(t.top);
    expect(plain(readTree(doc, tree))).toBe(plain(readTree(doc)));
  });
});

describe("duplicating a note", () => {
  it("puts the copy right after the note, with its tags, links and words", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "F");
    const a = createNode(doc, "note", folder, "A");
    createNode(doc, "note", folder, "B");
    addTag(doc, a, "poetry");
    setWords(doc, a, 42);
    const copy = duplicateNote(doc, a);
    const tree = readTree(doc);
    expect(titles(tree.items.get(folder)!.children)).toEqual(["A", "A copy", "B"]);
    const node = tree.byId.get(copy)!;
    expect(node.tags).toEqual(["poetry"]);
    expect(node.words).toBe(42);
    expect(node.id).not.toBe(a);
  });

  it("works at the top level and for an untitled note", () => {
    const doc = new Y.Doc();
    const a = createNode(doc, "note", ROOT, "");
    createNode(doc, "note", ROOT, "B");
    duplicateNote(doc, a);
    expect(titles(readTree(doc).top)).toEqual(["", "", "B"]);
  });

  it("refuses folders and books", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "F");
    expect(() => duplicateNote(doc, folder)).toThrow();
  });
});

describe("page settings", () => {
  it("sets, reads and clears one setting at a time, and merges two devices", async () => {
    const { ROOT, createNode, readTree, setProp } = await import("../src");
    const a = new Y.Doc();
    const id = createNode(a, "note", ROOT, "Chapter");
    expect(readTree(a).byId.get(id)!.props).toEqual({});
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    setProp(a, id, "layout", "pages");
    setProp(b, id, "goal", 2000);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(readTree(b).byId.get(id)!.props).toEqual({ layout: "pages", goal: 2000 });
    const before = readTree(a);
    setProp(a, id, "layout", null);
    const after = readTree(a, before);
    expect(after.byId.get(id)!.props).toEqual({ goal: 2000 });
    expect(after.byId.get(id)).not.toBe(before.byId.get(id));
  });
});

describe("changing a page's kind", () => {
  it("turns a folder into a note that keeps everything inside", () => {
    const doc = new Y.Doc();
    const folder = createNode(doc, "folder", ROOT, "Journal");
    createNode(doc, "note", folder, "Day one");
    createNode(doc, "folder", folder, "Old days");
    setKind(doc, folder, "note");
    const item = readTree(doc).items.get(folder)!;
    expect(item.kind).toBe("note");
    expect(titles(item.children)).toEqual(["Day one", "Old days"]);
  });

  it("refuses a kind the place cannot hold", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Book");
    const chapter = createNode(doc, "note", book, "Chapter");
    expect(() => setKind(doc, chapter, "folder")).toThrow();
    expect(() => setKind(doc, book, "folder")).not.toThrow();
    const top = createNode(doc, "note", ROOT, "Holds a folder");
    createNode(doc, "folder", top, "Inside");
    expect(() => setKind(doc, top, "book")).toThrow();
    expect(readTree(doc).items.get(top)!.kind).toBe("note");
  });
});
