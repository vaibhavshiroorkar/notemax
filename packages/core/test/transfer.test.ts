import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, WELCOME_ID, addTag, copyNodesTo, createNode, ensureWelcome, readTree, setLinks, setProp, trashNode } from "../src";

describe("copying pages to another workspace", () => {
  it("copies a page and everything inside it to the end of the other top level", () => {
    const from = new Y.Doc();
    const folder = createNode(from, "folder", ROOT, "Trip");
    const plan = createNode(from, "note", folder, "Plan");
    const inner = createNode(from, "note", plan, "Packing");
    addTag(from, plan, "travel");
    setProp(from, plan, "layout", "pages");

    const to = new Y.Doc();
    createNode(to, "note", ROOT, "Already here");
    const ids = copyNodesTo(from, folder, to);

    const tree = readTree(to);
    expect(tree.top.map((n) => n.title)).toEqual(["Already here", "Trip"]);
    const trip = tree.top[1];
    expect(trip.children.map((n) => n.title)).toEqual(["Plan"]);
    expect(trip.children[0].children.map((n) => n.title)).toEqual(["Packing"]);
    expect(trip.children[0].tags).toEqual(["travel"]);
    expect(trip.children[0].props.layout).toBe("pages");
    expect([...ids.keys()].sort()).toEqual([folder, plan, inner].sort());
    // Nothing clashed, so the ids stay the same.
    expect([...ids.entries()].every(([a, b]) => a === b)).toBe(true);
    // The original is untouched.
    expect(readTree(from).top.map((n) => n.title)).toEqual(["Trip"]);
  });

  it("gives a new id to a page whose id the other workspace already uses, and points links at it", () => {
    const from = new Y.Doc();
    ensureWelcome(from);
    const other = createNode(from, "note", WELCOME_ID, "Inside welcome");
    setLinks(from, other, [WELCOME_ID]);

    const to = new Y.Doc();
    ensureWelcome(to);
    const ids = copyNodesTo(from, WELCOME_ID, to);

    const fresh = ids.get(WELCOME_ID)!;
    expect(fresh).not.toBe(WELCOME_ID);
    expect(ids.get(other)).toBe(other);
    const tree = readTree(to);
    expect(tree.top.map((n) => n.id)).toEqual([WELCOME_ID, fresh]);
    expect(tree.items.get(other)!.parentId).toBe(fresh);
    expect(tree.byId.get(other)!.links).toEqual([fresh]);
  });

  it("leaves trashed pages behind", () => {
    const from = new Y.Doc();
    const book = createNode(from, "book", ROOT, "Novel");
    createNode(from, "note", book, "Kept");
    const gone = createNode(from, "note", book, "Cut");
    trashNode(from, gone);

    const to = new Y.Doc();
    const ids = copyNodesTo(from, book, to);
    expect(ids.has(gone)).toBe(false);
    expect(readTree(to).top[0].children.map((n) => n.title)).toEqual(["Kept"]);
  });
});
