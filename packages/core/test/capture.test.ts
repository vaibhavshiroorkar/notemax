import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { INBOX, WORKSPACE_DOC_ID, captureNote, createSqlStore, openLocalDoc, readTree, splitCapture } from "../src";
import { memorySqlDatabase } from "./node-sqlite";

let channelCount = 0;
// A fresh channel per test, so tests running in one process never hear each other.
const freshChannel = () => `test-channel-${++channelCount}`;
const paragraphs = (doc: Y.Doc) =>
  doc.getXmlFragment("content").toArray().map((p) => (p as Y.XmlElement).toArray().map(String).join(""));

describe("live updates between windows", () => {
  it("shows a saved edit in another open copy of the doc", async () => {
    const store = createSqlStore(memorySqlDatabase());
    const broadcast = freshChannel();
    const main = await openLocalDoc(store, "note", { broadcast });
    const other = await openLocalDoc(store, "note", { broadcast });

    other.doc.getText("t").insert(0, "from the other window");
    await other.flush();
    await vi.waitFor(() => expect(main.doc.getText("t").toString()).toBe("from the other window"));

    // The receiver must not write the edit a second time.
    expect(main.status().state).toBe("saved");
    await Promise.all([main.close(), other.close()]);
    expect((await store.load("note")).updates).toHaveLength(1);
  });

  it("ignores other docs on the same channel", async () => {
    const store = createSqlStore(memorySqlDatabase());
    const broadcast = freshChannel();
    const a = await openLocalDoc(store, "a", { broadcast });
    const b = await openLocalDoc(store, "b", { broadcast });
    b.doc.getText("t").insert(0, "only in b");
    await b.flush();
    await new Promise((r) => setTimeout(r, 50));
    expect(a.doc.getText("t").toString()).toBe("");
    await Promise.all([a.close(), b.close()]);
  });
});

describe("splitCapture", () => {
  it("uses the first line as the title and keeps the rest", () => {
    expect(splitCapture("\n  Buy milk  \nand eggs\n\nsoon\n\n")).toEqual({ title: "Buy milk", body: ["and eggs", "", "soon"] });
  });

  it("returns null for blank text", () => {
    expect(splitCapture(" \n\t\n")).toBeNull();
  });
});

describe("captureNote", () => {
  it("saves a note with its body into the Inbox", async () => {
    const store = createSqlStore(memorySqlDatabase());
    const id = await captureNote(store, "Idea\nfirst line\nsecond line");

    const workspace = await openLocalDoc(store, WORKSPACE_DOC_ID);
    const node = readTree(workspace.doc).byId.get(id!);
    expect(node).toMatchObject({ kind: "note", parentId: INBOX, title: "Idea" });

    const note = await openLocalDoc(store, id!);
    expect(paragraphs(note.doc)).toEqual(["first line", "second line"]);
  });

  it("saves nothing for blank text", async () => {
    const store = createSqlStore(memorySqlDatabase());
    expect(await captureNote(store, "   ")).toBeNull();
    expect((await store.load(WORKSPACE_DOC_ID)).updates).toHaveLength(0);
  });

  it("appears in an open main window without a reload", async () => {
    const store = createSqlStore(memorySqlDatabase());
    const broadcast = freshChannel();
    const main = await openLocalDoc(store, WORKSPACE_DOC_ID, { broadcast });

    const id = await captureNote(store, "Captured while the app was open", { broadcast });
    await vi.waitFor(() => expect(readTree(main.doc).byId.get(id!)?.title).toBe("Captured while the app was open"));
    await main.close();
  });
});
