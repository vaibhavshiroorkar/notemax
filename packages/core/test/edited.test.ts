import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, createNode, readTree, renameNode, touchNode } from "../src";

describe("edited time", () => {
  it("starts as the created time", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "A");
    const node = readTree(doc).byId.get(id)!;
    expect(node.editedAt).toBe(node.createdAt);
  });

  it("moves forward when the page is edited, at most once a minute", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "A");
    const created = readTree(doc).byId.get(id)!.createdAt;
    touchNode(doc, id, created + 10_000);
    expect(readTree(doc).byId.get(id)!.editedAt).toBe(created);
    touchNode(doc, id, created + 61_000);
    expect(readTree(doc).byId.get(id)!.editedAt).toBe(created + 61_000);
    touchNode(doc, id, created + 90_000);
    expect(readTree(doc).byId.get(id)!.editedAt).toBe(created + 61_000);
  });

  it("counts a rename as an edit", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "A");
    const fields = doc.getMap<Y.Map<unknown>>("nodes").get(id)!;
    fields.set("createdAt", 1000);
    fields.delete("editedAt");
    renameNode(doc, id, "B");
    expect(readTree(doc).byId.get(id)!.editedAt).toBeGreaterThan(1000);
  });

  it("gives the tree a new item when only the edited time changed", () => {
    const doc = new Y.Doc();
    const id = createNode(doc, "note", ROOT, "A");
    const before = readTree(doc);
    touchNode(doc, id, Date.now() + 120_000);
    const after = readTree(doc, before);
    expect(after.byId.get(id)).not.toBe(before.byId.get(id));
  });
});
