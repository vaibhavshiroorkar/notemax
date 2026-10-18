import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { WIKI_LINK, countWords } from "../src";

function paragraph(...parts: (string | Y.XmlElement)[]) {
  const p = new Y.XmlElement("paragraph");
  p.insert(0, parts.map((part) => (typeof part === "string" ? new Y.XmlText(part) : part)));
  return p;
}

describe("countWords", () => {
  it("counts words across blocks without joining the last and first word", () => {
    const body = new Y.Doc().getXmlFragment("content");
    body.insert(0, [paragraph("One two  three"), paragraph("four"), new Y.XmlElement("horizontalRule"), paragraph("  ")]);
    expect(countWords(body)).toBe(4);
  });

  it("counts bold text in the middle of a word once", () => {
    const body = new Y.Doc().getXmlFragment("content");
    const p = paragraph("");
    body.insert(0, [p]);
    const text = p.get(0) as Y.XmlText;
    text.insert(0, "un");
    text.insert(2, "break", { bold: true });
    text.insert(7, "able words");
    expect(countWords(body)).toBe(2);
  });

  it("keeps the words on either side of a link apart", () => {
    const body = new Y.Doc().getXmlFragment("content");
    const link = new Y.XmlElement(WIKI_LINK);
    link.setAttribute("targetId", "x");
    body.insert(0, [paragraph("see", link, "later")]);
    expect(countWords(body)).toBe(2);
  });

  it("is zero for an empty note", () => {
    expect(countWords(new Y.Doc().getXmlFragment("content"))).toBe(0);
  });
});
