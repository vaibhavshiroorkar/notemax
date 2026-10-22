import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { ROOT, addTag, buildGraph, createNode, readTree, setLinks, tagDot, trashNode } from "../src";

function workspace() {
  const doc = new Y.Doc();
  const folder = createNode(doc, "folder", ROOT, "Folder");
  const a = createNode(doc, "note", folder, "A");
  const b = createNode(doc, "note", ROOT, "B");
  const c = createNode(doc, "note", ROOT, "C");
  const d = createNode(doc, "note", ROOT, "D");
  const lonely = createNode(doc, "board", ROOT, "Lonely");
  setLinks(doc, a, [b]);
  setLinks(doc, b, [a, c]);
  setLinks(doc, c, [d]);
  return { doc, folder, a, b, c, d, lonely };
}

const pairs = (edges: { source: string; target: string }[]) => edges.map((e) => [e.source, e.target].sort().join("-")).sort();

describe("graph", () => {
  it("draws pages as dots and each link once", () => {
    const { doc, a, b, c, d, lonely, folder } = workspace();
    const { nodes, edges } = buildGraph(readTree(doc));
    expect(nodes.map((n) => n.id).sort()).toEqual([a, b, c, d, lonely].sort());
    expect(nodes.some((n) => n.id === folder)).toBe(false);
    expect(pairs(edges)).toEqual(pairs([{ source: a, target: b }, { source: b, target: c }, { source: c, target: d }]));
    expect(nodes.find((n) => n.id === b)!.degree).toBe(2);
  });

  it("says how deep each page sits, so higher pages can be drawn bigger", () => {
    const { doc, a, b, folder } = workspace();
    const sub = createNode(doc, "note", a, "Under A");
    const { nodes } = buildGraph(readTree(doc), { containers: true });
    const level = (id: string) => nodes.find((n) => n.id === id)!.level;
    expect([level(folder), level(b), level(a), level(sub)]).toEqual([0, 0, 1, 2]);
  });

  it("can show folders joined to what they hold, and hide lonely pages", () => {
    const { doc, folder, a, lonely } = workspace();
    const withFolders = buildGraph(readTree(doc), { containers: true });
    expect(withFolders.edges).toContainEqual({ source: folder, target: a, kind: "contains" });
    expect(buildGraph(readTree(doc), { hideLonely: true }).nodes.some((n) => n.id === lonely)).toBe(false);
  });

  it("keeps only the pages near the center in a local graph", () => {
    const { doc, a, b, c, d } = workspace();
    const one = buildGraph(readTree(doc), { around: { center: b, depth: 1 } });
    expect(one.nodes.map((n) => [n.id, n.depth])).toEqual(expect.arrayContaining([[b, 0], [a, 1], [c, 1]]));
    expect(one.nodes.some((n) => n.id === d)).toBe(false);
    const two = buildGraph(readTree(doc), { around: { center: b, depth: 2 } });
    expect(two.nodes.find((n) => n.id === d)!.depth).toBe(2);
  });

  it("leaves out trashed pages and links to them", () => {
    const { doc, b, c } = workspace();
    trashNode(doc, c);
    const { nodes, edges } = buildGraph(readTree(doc));
    expect(nodes.some((n) => n.id === c)).toBe(false);
    expect(edges.some((e) => e.source === c || e.target === c)).toBe(false);
    expect(nodes.find((n) => n.id === b)!.degree).toBe(1);
  });

  it("can show tags as dots joined to their pages", () => {
    const { doc, a, c } = workspace();
    addTag(doc, a, "plot");
    addTag(doc, c, "plot");
    addTag(doc, c, "Draft");
    const { nodes, edges } = buildGraph(readTree(doc), { tags: true });
    expect(nodes.find((n) => n.id === tagDot("plot"))).toMatchObject({ title: "#plot", kind: "tag", degree: 2 });
    expect(edges).toContainEqual({ source: c, target: tagDot("draft"), kind: "tagged" });
    expect(buildGraph(readTree(doc)).nodes.some((n) => n.kind === "tag")).toBe(false);
  });
});
