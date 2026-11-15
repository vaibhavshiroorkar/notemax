import { describe, expect, it } from "vitest";
import { createMemoryStore, openLocalDoc, packBackup, readBackup, restoreBackup, type DocStore } from "../src";

const write = async (store: DocStore, docId: string, text: string) => {
  const local = await openLocalDoc(store, docId, { batchMs: 0 });
  local.doc.getText("body").insert(local.doc.getText("body").length, text);
  await local.close();
};
const read = async (store: DocStore, docId: string) => {
  const local = await openLocalDoc(store, docId);
  const text = local.doc.getText("body").toString();
  await local.close();
  return text;
};

describe("backup", () => {
  it("brings back every doc, versions and pictures included", async () => {
    const from = createMemoryStore();
    await write(from, "note", "hello");
    await write(from, "history:note", "v1");
    await write(from, "asset:abc", "picture");
    const bytes = await packBackup(from, { app: "0.117.0", made: 1000 });
    const { info, docs } = readBackup(bytes);
    expect(info).toEqual({ app: "0.117.0", made: 1000 });
    expect([...docs.keys()].sort()).toEqual(["asset:abc", "history:note", "note"]);
    const to = createMemoryStore();
    expect(await restoreBackup(to, bytes)).toBe(3);
    expect(await read(to, "note")).toBe("hello");
    expect(await read(to, "history:note")).toBe("v1");
    expect(await read(to, "asset:abc")).toBe("picture");
  });

  it("keeps edits made after the backup when restoring onto them", async () => {
    const store = createMemoryStore();
    await write(store, "note", "before ");
    const bytes = await packBackup(store, { app: "x", made: 1 });
    await write(store, "note", "after");
    await restoreBackup(store, bytes);
    expect(await read(store, "note")).toBe("before after");
  });

  it("changes nothing when restored twice", async () => {
    const from = createMemoryStore();
    await write(from, "note", "once");
    const bytes = await packBackup(from, { app: "x", made: 1 });
    const to = createMemoryStore();
    await restoreBackup(to, bytes);
    await restoreBackup(to, bytes);
    expect(await read(to, "note")).toBe("once");
  });

  it("refuses a file that is not a backup", () => {
    expect(() => readBackup(new TextEncoder().encode("hello, not a backup"))).toThrow("Not a Notemax backup");
    expect(() => readBackup(new Uint8Array())).toThrow("Not a Notemax backup");
  });

  it("refuses a backup cut short", async () => {
    const from = createMemoryStore();
    await write(from, "note", "some text here");
    const bytes = await packBackup(from, { app: "x", made: 1 });
    expect(() => readBackup(bytes.slice(0, bytes.length - 3))).toThrow("Not a Notemax backup");
  });
});
