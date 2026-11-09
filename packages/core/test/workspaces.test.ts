import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { addWorkspace, moveWorkspace, openIdbStore, readWorkspaces, removeWorkspace, renameWorkspace, scopedId, scopedStore, setWorkspaceLocked, setWorkspaceShared, splitScoped } from "../src";

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

  it("marks a workspace as shared, with or without a link secret, and back", () => {
    const doc = new Y.Doc();
    const id = addWorkspace(doc, "Team");
    expect(readWorkspaces(doc).find((w) => w.id === id)?.shared).toBeNull();
    setWorkspaceShared(doc, id, { space: "s1", token: "t1" });
    expect(readWorkspaces(doc).find((w) => w.id === id)?.shared).toEqual({ space: "s1", token: "t1" });
    setWorkspaceShared(doc, id, { space: "s1", token: null });
    expect(readWorkspaces(doc).find((w) => w.id === id)?.shared).toEqual({ space: "s1", token: null });
    setWorkspaceShared(doc, "main", { space: "s2", token: null });
    expect(readWorkspaces(doc).find((w) => w.id === "main")?.shared).toEqual({ space: "s2", token: null });
    setWorkspaceShared(doc, id, null);
    expect(readWorkspaces(doc).find((w) => w.id === id)?.shared).toBeNull();
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

  it("locks and unlocks a workspace, main included, and old lists read unlocked", () => {
    const doc = new Y.Doc();
    addWorkspace(doc, "Diary", "", "diary");
    expect(readWorkspaces(doc).every((w) => !w.locked)).toBe(true);
    setWorkspaceLocked(doc, "diary", true);
    setWorkspaceLocked(doc, "main", true);
    expect(readWorkspaces(doc).filter((w) => w.locked).map((w) => w.id).sort()).toEqual(["diary", "main"]);
    setWorkspaceLocked(doc, "diary", false);
    expect(readWorkspaces(doc).find((w) => w.id === "diary")!.locked).toBe(false);
  });
});
