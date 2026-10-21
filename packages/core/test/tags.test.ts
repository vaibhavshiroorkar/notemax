import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, addTag, createNode, normalizeTag, readTree, removeTag, searchNodes, trashNode } from "../src";

/** Copies every change each doc has that the other is missing, like two devices syncing. */
function sync(a: Y.Doc, b: Y.Doc) {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
}

describe("normalizeTag", () => {
  it("turns different spellings into one tag", () => {
    expect(normalizeTag("Sci Fi")).toBe("sci-fi");
    expect(normalizeTag("#SCI-FI")).toBe("sci-fi");
    expect(normalizeTag("  ##sci-fi ")).toBe("sci-fi");
  });

  it("keeps letters from any language and drops punctuation", () => {
    expect(normalizeTag("Café!")).toBe("café");
    expect(normalizeTag("短編")).toBe("短編");
    expect(normalizeTag("a/b, c")).toBe("ab-c");
  });

  it("returns null when nothing usable is left", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag(" # ")).toBeNull();
    expect(normalizeTag("!!!")).toBeNull();
  });

  it("caps the length", () => {
    expect(normalizeTag("x".repeat(100))).toHaveLength(40);
  });
});

describe("tags", () => {
  it("adds, reads back sorted, and removes", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "Draft");
    expect(addTag(doc, id, "Poetry")).toBe("poetry");
    addTag(doc, id, "#drafts");
    addTag(doc, id, "poetry");
    expect(readTree(doc).byId.get(id)!.tags).toEqual(["drafts", "poetry"]);
    removeTag(doc, id, "drafts");
    expect(readTree(doc).byId.get(id)!.tags).toEqual(["poetry"]);
  });

  it("ignores a tag with nothing usable in it", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "Draft");
    expect(addTag(doc, id, "  #  ")).toBeNull();
    expect(readTree(doc).byId.get(id)!.tags).toEqual([]);
  });

  it("works on books and folders too", () => {
    const doc = new Y.Doc();
    const book = createNode(doc, "book", ROOT, "Novel");
    const folder = createNode(doc, "folder", ROOT, "Ideas");
    addTag(doc, book, "fantasy");
    addTag(doc, folder, "fantasy");
    expect(readTree(doc).tags).toEqual([{ tag: "fantasy", count: 2 }]);
  });

  it("counts visible items only, most used first", () => {
    const doc = new Y.Doc();
    const a = createNode(doc, "note", ROOT, "A");
    const b = createNode(doc, "note", ROOT, "B");
    const c = createNode(doc, "note", ROOT, "C");
    addTag(doc, a, "zine");
    addTag(doc, b, "zine");
    addTag(doc, b, "art");
    addTag(doc, c, "art");
    addTag(doc, c, "old");
    trashNode(doc, c);
    expect(readTree(doc).tags).toEqual([
      { tag: "zine", count: 2 },
      { tag: "art", count: 1 },
    ]);
  });

  it("keeps tags added on two devices at the same time", () => {
    const one = new Y.Doc();
    const id = createNode(one, "note", ROOT, "Shared");
    const two = new Y.Doc();
    sync(one, two);
    addTag(one, id, "fanfic");
    addTag(two, id, "romance");
    sync(one, two);
    expect(readTree(one).byId.get(id)!.tags).toEqual(["fanfic", "romance"]);
    expect(readTree(two).byId.get(id)!.tags).toEqual(["fanfic", "romance"]);
  });

  it("filters title search by tag, matching tag starts", () => {
    const doc = new Y.Doc();
    const a = createNode(doc, "note", ROOT, "Dragon notes");
    const b = createNode(doc, "note", ROOT, "Dragon book draft");
    createNode(doc, "note", ROOT, "Shopping");
    addTag(doc, a, "fanfic");
    addTag(doc, b, "fanfic");
    addTag(doc, b, "drafts");
    const tree = readTree(doc);
    expect(searchNodes(tree, "dragon", { tags: ["fan"] }).map((n) => n.title)).toEqual(["Dragon book draft", "Dragon notes"]);
    expect(searchNodes(tree, "", { tags: ["fanfic", "draft"] }).map((n) => n.title)).toEqual(["Dragon book draft"]);
    expect(searchNodes(tree, "", { tags: ["nothing"] })).toEqual([]);
  });
});
