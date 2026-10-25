import { useState } from "react";
import * as Y from "yjs";
import { listVersions, restoreBody, type TreeNode } from "@notemax/core";
import { withPageDoc } from "@/features/export/content";
import { ChangesView } from "@/features/history/ChangesView";
import { useVersionHtml } from "@/features/history/useVersionHtml";
import { saveNow } from "@/features/history/versions";
import { getStore } from "@/platform/platform";
import { savedStore } from "@/platform/store";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { Segmented } from "@/ui/Segmented";

/**
 * A note changed on two devices before they synced. Both changes are already
 * merged into the note, so nothing is lost; each side is also kept as a
 * version, and the person is asked whether to keep both or one.
 */
export interface Conflict {
  pageId: string;
  time: number;
  /** Version ids: this device's side, and the other device's. */
  mine: string;
  theirs: string;
}

/** Waiting questions. Saved, so one asked while the app was closing is asked again next time. */
export const conflicts = savedStore<Conflict[]>("syncConflicts", []);

const MINE = "This device, before syncing";
const THEIRS = "Another device";

/** Called by sync. Notes only: boards merge their drawings shape by shape, which is worth no question. */
export async function recordConflict(pageId: string, mine: Uint8Array, theirs: Uint8Array) {
  const isNote = (state: Uint8Array) => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);
    const has = doc.getXmlFragment("content").length > 0;
    doc.destroy();
    return has;
  };
  if (!isNote(mine) && !isNote(theirs)) return;
  const conflict: Conflict = { pageId, time: Date.now(), mine: await saveNow(pageId, mine, MINE), theirs: await saveNow(pageId, theirs, THEIRS) };
  conflicts.set([...conflicts.get().filter((c) => c.pageId !== pageId), conflict]);
}

const conflictOf = (list: Conflict[], pageId: string) => list.find((c) => c.pageId === pageId);

type Choice = "both" | "mine" | "theirs";
const settle = (pageId: string) => conflicts.set(conflicts.get().filter((c) => c.pageId !== pageId));

/** Keeps one side only. The merged note is kept as a version first, so this can be taken back. */
async function keepOne(pageId: string, versionId: string, label: string) {
  const version = (await listVersions(await getStore(), pageId)).find((v) => v.id === versionId);
  if (!version) return;
  const merged = await withPageDoc(pageId, (doc) => Y.encodeStateAsUpdate(doc));
  await saveNow(pageId, merged, `Both devices, merged (before keeping ${label})`);
  await withPageDoc(pageId, (doc) => restoreBody(doc, version));
  settle(pageId);
}

/** Answers the question one way, and says so. */
async function settleAs(conflict: Conflict, which: Choice, app: AppContext) {
  const title = app.tree.byId.get(conflict.pageId)?.title || "Untitled";
  const side = which === "mine" ? "this device's" : "the other device's";
  if (which === "both") settle(conflict.pageId);
  else await keepOne(conflict.pageId, which === "mine" ? conflict.mine : conflict.theirs, side);
  app.notify(which === "both" ? `Kept both changes to "${title}"` : `Kept ${side} "${title}"`);
}

/** Both sides next to each other, and the three choices. */
export function ConflictDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const pageId = options.pageId as string;
  const conflict = conflictOf(conflicts.use(), pageId);
  const mine = useVersionHtml(pageId, conflict?.mine ?? "", app.tree);
  const theirs = useVersionHtml(pageId, conflict?.theirs ?? "", app.tree);
  const title = app.tree.byId.get(pageId)?.title || "Untitled";
  const [view, setView] = useState<"changes" | "sides">("changes");

  const choose = async (which: Choice) => {
    if (conflict) await settleAs(conflict, which, app);
    onClose();
  };

  return (
    <Dialog label={`${title} changed on two devices`} onClose={onClose} className="conflict-dialog">
      <h2 className="dialog-title">"{title}" changed on two devices</h2>
      <p className="dialog-message">
        It was edited here and on another device before they synced. Both changes are in the note now, so nothing is lost. Keep both, or keep one side as it was.
      </p>
      <Segmented<"changes" | "sides">
        label="Show"
        value={view}
        options={[
          { value: "changes", label: "Differences" },
          { value: "sides", label: "Side by side" },
        ]}
        onChange={setView}
      />
      {view === "changes" ? (
        // This device's side is the one compared from: red is only here, green only on the other device.
        <div className="conflict-changes">
          <ChangesView old={mine.body} now={theirs.body} tree={app.tree} legend={{ gone: "only on this device", changed: "worded differently", added: "only on the other device" }} className="conflict-body" />
        </div>
      ) : (
        <div className="conflict-sides">
          <section>
            <h3>{MINE}</h3>
            <div className="editor conflict-body" dangerouslySetInnerHTML={{ __html: mine.html ?? "" }} />
          </section>
          <section>
            <h3>{THEIRS}</h3>
            <div className="editor conflict-body" dangerouslySetInnerHTML={{ __html: theirs.html ?? "" }} />
          </section>
        </div>
      )}
      <div className="dialog-actions">
        <button className="button" disabled={!mine.version} onClick={() => void choose("mine")}>
          Keep this device's
        </button>
        <button className="button" disabled={!theirs.version} onClick={() => void choose("theirs")}>
          Keep the other device's
        </button>
        <button className="button button-primary" onClick={() => void choose("both")}>
          Keep both
        </button>
      </div>
    </Dialog>
  );
}

/** Opens the recovery choices without crowding the note. */
export function ConflictLine({ node, app }: { node: TreeNode; app: AppContext }) {
  const conflict = conflictOf(conflicts.use(), node.id);
  if (!conflict) return null;
  return (
    <p className="conflict-line">
      <button className="link-button" title="Review changes from two devices" onClick={() => app.openOverlay("sync.conflict", { pageId: node.id })}>
        Review
      </button>
    </p>
  );
}
