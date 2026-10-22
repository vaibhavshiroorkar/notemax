import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addWorkspace, moveWorkspace, openIdbStore, readWorkspaces, removeWorkspace, renameWorkspace, scopedId, scopedStore, splitScoped } from "../src";

describe("workspaces", () => {
  it("keeps the first workspace's ids as they were and prefixes the others", () => {
    expect(scopedId("main", "workspace")).toBe("workspace");
    expect(scopedId("w2", "workspace")).toBe("ws:w2:workspace");
    expect(splitScoped("ws:w2:history:abc")).toEqual({ workspace: "w2", docId: "history:abc" });
    expect(splitScoped("asset:123")).toEqual({ workspace: "main", docId: "asset:123" });
    expect(splitScoped("workspaces")).toEqual({ workspace: null, docId: "workspaces" });
    expect(splitScoped("settings")).toEqual({ workspace: null, docId: "settings" });
  });

  it("gives each workspace its own docs in one store", async () => {
    const store = await openIdbStore(`ws-${Math.random()}`);
    const main = scopedStore(store, "main");
    const other = scopedStore(store, "w2");
    await main.append("note", new Uint8Array([1]));
    await other.append("note", new Uint8Array([2]));
    expect((await main.load("note")).updates).toEqual([new Uint8Array([1])]);
    expect((await other.load("note")).updates).toEqual([new Uint8Array([2])]);
    expect(await other.list()).toEqual(["note"]);
    expect((await store.list()).sort()).toEqual(["note", "ws:w2:note"]);
  });

  it("lists, names, arranges and removes workspaces, with main always there", () => {
    const doc = new Y.Doc();
    expect(readWorkspaces(doc).map((w) => w.id)).toEqual(["main"]);
    const work = addWorkspace(doc, "Work", "#1c7ed6", "work");
    const home = addWorkspace(doc, "Home", "", "home");
    renameWorkspace(doc, "main", "Writing");
    expect(readWorkspaces(doc).map((w) => w.name)).toEqual(["Writing", "Work", "Home"]);
    moveWorkspace(doc, home, 0);
    expect(readWorkspaces(doc).map((w) => w.id)).toEqual(["home", "main", "work"]);
    removeWorkspace(doc, work);
    expect(readWorkspaces(doc).map((w) => w.id)).toEqual(["home", "main"]);
    expect(() => removeWorkspace(doc, "main")).toThrow();
  });
});
