import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { listVersions, openIdbStore, restoreBody, saveVersion, versionDoc, versionsToKeep } from "../src";

const DAY = 24 * 60 * 60 * 1000;

function page(text: string) {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment("content").insert(0, [paragraph]);
  return doc;
}
const textOf = (doc: Y.Doc) => doc.getXmlFragment("content").toString();

describe("version history", () => {
  it("applies age and count limits to ordinary versions", () => {
    const now = 100 * DAY;
    const times = [now, now - DAY, now - 2 * DAY, now - 10 * DAY];
    expect([...versionsToKeep(times, now, { maxCount: 2, maxAgeDays: 7 })]).toEqual([0, 1]);
    expect([...versionsToKeep(times, now, { maxCount: 50, maxAgeDays: 1 })]).toEqual([0, 1]);
  });

  it("keeps recovery snapshots outside the ordinary version limits", async () => {
    const store = await openIdbStore(`history-${Math.random()}`);
    const doc = page("recovery text");
    const state = Y.encodeStateAsUpdate(doc);
    const recovery = await saveVersion(store, "limited", state, { time: DAY, label: "On another device" });
    await saveVersion(store, "limited", state, { time: 98 * DAY });
    const latest = await saveVersion(store, "limited", state, { time: 100 * DAY, retention: { maxCount: 1, maxAgeDays: 1 } });
    expect((await listVersions(store, "limited")).map((v) => v.id)).toEqual([latest, recovery]);
    doc.destroy();
  });

  it("saves versions and lists them newest first", async () => {
    const store = await openIdbStore(`history-${Math.random()}`);
    const doc = page("first");
    await saveVersion(store, "p1", Y.encodeStateAsUpdate(doc), { words: 1, time: 1000 });
    doc.getXmlFragment("content").insert(1, [new Y.XmlElement("paragraph")]);
    await saveVersion(store, "p1", Y.encodeStateAsUpdate(doc), { words: 1, time: 2000 });
    const versions = await listVersions(store, "p1");
    expect(versions.map((v) => v.time)).toEqual([2000, 1000]);
    expect(textOf(versionDoc(versions[1]))).toBe("<paragraph>first</paragraph>");
  });

  it("restores an old body as a new edit", async () => {
    const store = await openIdbStore(`history-${Math.random()}`);
    const doc = page("old words");
    await saveVersion(store, "p2", Y.encodeStateAsUpdate(doc), { time: 1000 });
    const fragment = doc.getXmlFragment("content");
    fragment.delete(0, fragment.length);
    fragment.insert(0, [new Y.XmlElement("heading")]);
    const [old] = await listVersions(store, "p2");
    restoreBody(doc, old);
    expect(textOf(doc)).toBe("<paragraph>old words</paragraph>");

    // Another device that had the newer body takes the restore too.
    const other = new Y.Doc();
    Y.applyUpdate(other, Y.encodeStateAsUpdate(doc));
    expect(textOf(other)).toBe("<paragraph>old words</paragraph>");
  });

  it("thins old versions: the last 20, one a day for a month, one a week after", () => {
    const now = 400 * DAY;
    const times = [
      ...Array.from({ length: 25 }, (_, i) => now - i * 60_000),
      now - 3 * DAY,
      now - 3 * DAY + 60_000,
      now - 60 * DAY,
      now - 61 * DAY,
    ];
    const keep = versionsToKeep(times, now);
    // The newest 20, one more for today, one for three days ago, one for that week two months ago.
    expect(keep.size).toBe(20 + 1 + 1 + 1);
    expect([keep.has(20), keep.has(21), keep.has(25) !== keep.has(26), keep.has(27) !== keep.has(28)]).toEqual([true, false, true, true]);
  });
});
