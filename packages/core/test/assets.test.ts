import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { createSqlStore, isAssetId, loadAsset, openIdbStore, saveAsset } from "../src";
import { memorySqlDatabase } from "./node-sqlite";

describe.each([
  ["IndexedDB", () => openIdbStore("assets-test")],
  ["SQLite", async () => createSqlStore(memorySqlDatabase())],
])("assets in %s", (_name, freshStore) => {
  it("keeps a file by its hash and gives it back", async () => {
    const store = await freshStore();
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const id = await saveAsset(store, { bytes, type: "image/png", name: "dot.png" });
    expect(isAssetId(id)).toBe(true);
    const back = await loadAsset(store, id);
    expect(back?.type).toBe("image/png");
    expect(back?.name).toBe("dot.png");
    expect([...back!.bytes]).toEqual([...bytes]);
  });

  it("keeps the same bytes once, and knows nothing of a missing id", async () => {
    const store = await freshStore();
    const bytes = new Uint8Array([1, 2, 3]);
    const a = await saveAsset(store, { bytes, type: "image/gif", name: "a.gif" });
    const b = await saveAsset(store, { bytes, type: "image/gif", name: "copy.gif" });
    expect(b).toBe(a);
    expect((await loadAsset(store, a))?.name).toBe("a.gif");
    expect(await loadAsset(store, "0".repeat(64))).toBeNull();
    expect(await loadAsset(store, "not-an-id")).toBeNull();
  });
});
