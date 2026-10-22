import { useEffect } from "react";
import * as Y from "yjs";
import { countWords, listVersions, saveVersion } from "@notemax/core";
import { getStore } from "@/platform/platform";
import { createStore, savedStore } from "@/platform/store";
import { registry } from "@/plugins/registry";

/** Minutes of editing between versions. 0 turns versions off. */
export const versionEvery = savedStore<number>("versionEvery", 10);

/** Goes up whenever a version is saved, so lists of versions read them again. */
export const versionsSaved = createStore(0);

/** Saves a page's state as a version, with the words it had then. */
export async function saveNow(pageId: string, state: Uint8Array) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const words = countWords(doc.getXmlFragment("content"));
  doc.destroy();
  await saveVersion(await getStore(), pageId, state, { words });
  versionsSaved.set(versionsSaved.get() + 1);
}

/**
 * Saves versions of an open page while it is edited: how it was before the
 * first edit in a while, then one every few minutes of editing, then how it
 * was left. Opening and reading a page saves nothing.
 */
export function useVersions(body: Y.Doc | undefined, pageId: string) {
  useEffect(() => {
    if (!body || !registry.isOn("history")) return;
    // Null until the newest saved version is known.
    let last: number | null = null;
    let changed = false;
    let live = true;
    // Taken now, since the first edit is what makes it worth keeping. An empty page has nothing to keep.
    const before = Y.encodeStateAsUpdate(body);
    let keptBefore = body.getXmlFragment("content").length === 0;
    getStore()
      .then((store) => listVersions(store, pageId))
      .then((versions) => {
        if (live) last = versions[0]?.time ?? 0;
      })
      .catch(() => {});

    const save = (state: Uint8Array) => {
      last = Date.now();
      saveNow(pageId, state).catch((err) => console.warn("[notemax] could not save a version", pageId, err));
    };
    const onUpdate = () => {
      const every = versionEvery.get() * 60_000;
      if (!every || last === null) return;
      changed = true;
      const due = Date.now() - last >= every;
      if (!keptBefore) {
        keptBefore = true;
        if (due) save(before);
      } else if (due) {
        save(Y.encodeStateAsUpdate(body));
        changed = false;
      }
    };
    body.on("update", onUpdate);
    return () => {
      live = false;
      body.off("update", onUpdate);
      if (changed && versionEvery.get() > 0) save(Y.encodeStateAsUpdate(body));
    };
  }, [body, pageId]);
}
