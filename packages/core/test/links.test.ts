import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { INBOX, ROOT, WIKI_LINK, createNode, extractLinks, readTree, searchNodes, setLinks, trashNode } from "../src";

function bodyWithLinks(...targets: string[]) {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [
    new Y.XmlText("see "),
    ...targets.map((targetId) => {
      const link = new Y.XmlElement(WIKI_LINK);
      link.setAttribute("targetId", targetId);
      return link;
    }),
  ]);
  // Links inside a list item must be found too.
  const list = new Y.XmlElement("bulletList");
  const item = new Y.XmlElement("listItem");
  const nested = new Y.XmlElement("paragraph");
  const deep = new Y.XmlElement(WIKI_LINK);
  deep.setAttribute("targetId", "deep");
  nested.insert(0, [deep]);
  item.insert(0, [nested]);
  list.insert(0, [item]);
  doc.getXmlFragment("content").insert(0, [paragraph, list]);
  return doc.getXmlFragment("content");
}

describe("extractLinks", () => {
  it("finds links anywhere in the body", () => {
    expect(extractLinks(bodyWithLinks("a", "b"))).toEqual(["a", "b", "deep"]);
  });

  it("returns nothing for an empty body", () => {
    expect(extractLinks(new Y.Doc().getXmlFragment("content"))).toEqual([]);
  });
});

describe("backlinks", () => {
  it("lists the notes that link to a target", () => {
    const doc = new Y.Doc();
    const target = createNode(doc, "note", INBOX, "Target");
    const b = createNode(doc, "note", INBOX, "Beta");
    const a = createNode(doc, "note", INBOX, "Alpha");
    setLinks(doc, a, [target]);
    setLinks(doc, b, [target, target]);
    expect(readTree(doc).backlinks.get(target)?.map((n) => n.title)).toEqual(["Alpha", "Beta"]);
  });

  it("drops links that were removed from the body", () => {
    const doc = new Y.Doc();
    const target = createNode(doc, "note", INBOX, "Target");
    const a = createNode(doc, "note", INBOX, "A");
    setLinks(doc, a, [target]);
    setLinks(doc, a, []);
    expect(readTree(doc).backlinks.get(target)).toBeUndefined();
  });

  it("ignores links from trashed notes and links to itself", () => {
    const doc = new Y.Doc();
    const target = createNode(doc, "note", INBOX, "Target");
    const a = createNode(doc, "note", INBOX, "A");
    setLinks(doc, a, [target]);
    trashNode(doc, a);
    setLinks(doc, target, [target]);
    expect(readTree(doc).backlinks.get(target)).toBeUndefined();
  });

  it("does not write when the links did not change", () => {
    const doc = new Y.Doc();
    const a = createNode(doc, "note", INBOX, "A");
    setLinks(doc, a, ["x", "y"]);
    let writes = 0;
    doc.on("update", () => writes++);
    setLinks(doc, a, ["y", "x", "y"]);
    expect(writes).toBe(0);
  });
});

describe("searchNodes", () => {
  const doc = new Y.Doc();
  const book = createNode(doc, "book", ROOT, "Garden Book");
  const ids = {
    garden: createNode(doc, "note", INBOX, "Garden"),
    gardening: createNode(doc, "note", book, "Gardening tips"),
    my: createNode(doc, "note", INBOX, "My garden plan"),
    regard: createNode(doc, "note", INBOX, "Kindergarden"),
    other: createNode(doc, "note", INBOX, "Cooking"),
  };
  const titles = (q: string, exclude?: string) => searchNodes(readTree(doc), q, { exclude }).map((n) => n.title);

  it("ranks exact, then prefix, then word start, then anywhere", () => {
    expect(titles("garden")).toEqual(["Garden", "Garden Book", "Gardening tips", "My garden plan", "Kindergarden"]);
  });

  it("is case-insensitive and can leave out the current note", () => {
    expect(titles("GARDEN", ids.garden)).not.toContain("Garden");
  });

  it("does not match unrelated titles", () => {
    expect(titles("garden")).not.toContain("Cooking");
  });
});
