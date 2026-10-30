import { useEffect } from "react";
import * as Y from "yjs";
import { authorsOf, countWords, listVersions, saveVersion, stampAuthor } from "@notemax/core";
import { usePageWorkspace } from "@/data/scope";
import { storeFor } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { savedStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import { markHistoryChanged, me, onHistory } from "./audit";

/** Minutes of editing between versions. 0 turns versions off. */
export const versionEvery = savedStore<number>("versionEvery", 10);
export const versionLimit = savedStore<number>("versionLimit", 100);
export const versionDays = savedStore<number>("versionDays", 0);

/** Saves a page's state as a version, with the words it had then and whose edits are new in it. Returns its id. */
export async function saveNow(pageId: string, state: Uint8Array, label: string | null = null, workspace = workspaceNow()): Promise<string> {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const words = countWords(doc.getXmlFragment("content"));
  const authors = authorsOf(doc);
  doc.destroy();
  const id = await onHistory(workspace, pageId, async () =>
    saveVersion(await storeFor(workspace), pageId, state, {
      words, label, authors, retention: { maxCount: versionLimit.get(), maxAgeDays: versionDays.get() },
    }),
  );
  markHistoryChanged();
  return id;
}

/**
 * Saves versions of an open page while it is edited: how it was before the
 * first edit in a while, then one every few minutes of editing, then how it
 * was left. Opening and reading a page saves nothing.
 */
export function useVersions(body: Y.Doc | undefined, pageId: string) {
  const workspace = usePageWorkspace();
  useEffect(() => {
    if (!body || !registry.isOn("history")) return;
    // Null until the newest saved version is known.
    let last: number | null = null;
    let changed = false;
    let live = true;
    // Taken now, since the first edit is what makes it worth keeping. An empty page has nothing to keep.
    const before = Y.encodeStateAsUpdate(body);
    let keptBefore = body.getXmlFragment("content").length === 0;
    storeFor(workspace)
      .then((store) => listVersions(store, pageId))
      .then((versions) => {
        if (live) last = versions[0]?.time ?? 0;
      })
      .catch((err) => {
        // Unknown, so treated as none: versions keep being made rather than stopping for good.
        console.warn("[notemax] could not list versions", pageId, err);
        if (live) last = 0;
      });

    const save = (state: Uint8Array) => {
      last = Date.now();
      saveNow(pageId, state, null, workspace).catch((err) => console.warn("[notemax] could not save a version", pageId, err));
    };
    let stamped = false;
    const onUpdate = (_update: Uint8Array, _origin: unknown, _doc: Y.Doc, transaction: Y.Transaction) => {
      // The first edit made here says who made it, so versions can name them.
      // After this update is done, as a change of its own.
      if (!stamped && transaction.local) {
        stamped = true;
        queueMicrotask(() => body.transact(() => stampAuthor(body, me())));
      }
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
  }, [body, pageId, workspace]);
}
