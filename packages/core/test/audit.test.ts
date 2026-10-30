import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { authorsOf, listLog, listVersions, logEvent, openIdbStore, saveVersion, stampAuthor, type Author } from "../src";

const DAY = 24 * 60 * 60 * 1000;
const ana: Author = { name: "Ana", device: "Chrome on Android", deviceId: "web-ana" };
const ben: Author = { name: "Ben", device: "Desktop app on Windows", deviceId: "desktop-ben" };

/** Types into the page as its own copy would, stamping who it is first. */
function write(doc: Y.Doc, who: Author, text: string) {
  stampAuthor(doc, who);
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment("content").push([paragraph]);
}

/** Two copies of one page, as two devices or two people with a shared link have. */
function pair() {
  const a = new Y.Doc();
  const b = new Y.Doc();
  const sync = () => {
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a, Y.encodeStateVector(b)));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b, Y.encodeStateVector(a)));
  };
  return { a, b, sync };
}

describe("who did what", () => {
  it("a version names whose edits are new since the one before", async () => {
    const store = await openIdbStore(`audit-${Math.random()}`);
    const { a, b, sync } = pair();
    write(a, ana, "from Ana");
    await saveVersion(store, "p", Y.encodeStateAsUpdate(a), { time: 1000, authors: authorsOf(a) });
    write(b, ben, "from Ben");
    sync();
    await saveVersion(store, "p", Y.encodeStateAsUpdate(a), { time: 2000, authors: authorsOf(a) });
    write(a, ana, "Ana again");
    write(b, ben, "Ben again");
    sync();
    await saveVersion(store, "p", Y.encodeStateAsUpdate(a), { time: 3000, authors: authorsOf(a) });

    const [third, second, first] = await listVersions(store, "p");
    expect(first.by?.map((who) => who.name)).toEqual(["Ana"]);
    expect(second.by?.map((who) => who.name)).toEqual(["Ben"]);
    expect(third.by?.map((who) => who.name).sort()).toEqual(["Ana", "Ben"]);
  });

  it("a stamp is written once per copy, and again only if who it is changes", () => {
    const doc = new Y.Doc();
    let updates = 0;
    doc.on("update", () => updates++);
    stampAuthor(doc, ana);
    stampAuthor(doc, ana);
    expect(updates).toBe(1);
    stampAuthor(doc, { ...ana, name: "Ana Lima" });
    expect(updates).toBe(2);
    expect(authorsOf(doc).get(doc.clientID)?.name).toBe("Ana Lima");
  });

  it("versions from before authors were kept have none, and are still listed", async () => {
    const store = await openIdbStore(`audit-${Math.random()}`);
    const doc = new Y.Doc();
    write(doc, ana, "old");
    await saveVersion(store, "p", Y.encodeStateAsUpdate(doc), { time: 1000 });
    expect((await listVersions(store, "p"))[0].by).toBeNull();
  });

  it("thinning out versions hands their authors to the next one kept", async () => {
    const store = await openIdbStore(`audit-${Math.random()}`);
    const { a, b, sync } = pair();
    write(b, ben, "Ben's line");
    sync();
    await saveVersion(store, "p", Y.encodeStateAsUpdate(a), { time: 100 * DAY - 3000, authors: authorsOf(a) });
    write(a, ana, "Ana's line");
    await saveVersion(store, "p", Y.encodeStateAsUpdate(a), { time: 100 * DAY, authors: authorsOf(a), retention: { maxCount: 1 } });
    const versions = await listVersions(store, "p");
    expect(versions).toHaveLength(1);
    expect(versions[0].by?.map((who) => who.name).sort()).toEqual(["Ana", "Ben"]);
  });

  it("the log lists what was done, newest first, and keeps the last 500", async () => {
    const store = await openIdbStore(`audit-${Math.random()}`);
    await logEvent(store, "p", { who: ana, action: "renamed", detail: '"Draft" to "Final"', time: 1 });
    await logEvent(store, "p", { who: ben, action: "restored-version", detail: "Oct 28", time: 2 });
    const log = await listLog(store, "p");
    expect(log.map((entry) => [entry.who.name, entry.action, entry.detail])).toEqual([
      ["Ben", "restored-version", "Oct 28"],
      ["Ana", "renamed", '"Draft" to "Final"'],
    ]);
    for (let i = 0; i < 505; i++) await logEvent(store, "q", { who: ana, action: "saved-version", detail: null, time: 10 + i });
    const long = await listLog(store, "q");
    expect(long).toHaveLength(500);
    expect(long.at(-1)?.time).toBe(15);
  });
});
