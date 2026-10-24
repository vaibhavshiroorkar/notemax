import { useEffect, useState } from "react";
import * as Y from "yjs";
import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { restoreBody } from "@notemax/core";
import { withPageDoc } from "@/features/export/content";
import type { DocNode } from "@/features/export/serialize";
import { treeIn } from "@/data/trees";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Segmented } from "@/ui/Segmented";
import { ChangesView } from "./ChangesView";
import { useVersionHtml } from "./useVersionHtml";
import { saveNow } from "./versions";
import { whenOf } from "./VersionsPanel";

/** One saved version, read-only, with a button to make the page say that again. */
export function VersionPreview({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const pageId = options.pageId as string;
  const versionId = options.versionId as string;
  // A page in a tab from another workspace says which one, with its tree.
  const workspace = (options.workspace as string | undefined) ?? app.workspace;
  const tree = workspace === app.workspace ? app.tree : (treeIn(workspace) ?? app.tree);
  const { version, html, body } = useVersionHtml(pageId, versionId, tree, workspace);
  const [view, setView] = useState<"version" | "changes">("version");
  // The page as it is now, read when the changes are first asked for.
  const [now, setNow] = useState<DocNode | null>(null);
  useEffect(() => {
    if (view !== "changes" || now) return;
    void withPageDoc(pageId, (doc) => yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")) as DocNode, workspace).then(setNow);
  }, [view, now, pageId, workspace]);

  const restore = async () => {
    if (!version) return;
    // How the page is now becomes a version first, so the restore can be taken back too.
    const now = await withPageDoc(pageId, (doc) => Y.encodeStateAsUpdate(doc), workspace);
    await saveNow(pageId, now, null, workspace);
    await withPageDoc(pageId, (doc) => restoreBody(doc, version), workspace);
    app.notify(`Restored the version from ${whenOf(version.time)}`);
    onClose();
  };

  const title = tree.byId.get(pageId)?.title || "Untitled";
  return (
    <Dialog label={`${title}, an earlier version`} onClose={onClose} className="version-preview">
      <header className="version-preview-header">
        <div>
          <h2 className="dialog-title">{title}</h2>
          <p className="version-preview-when">{version ? whenOf(version.time) : "Loading..."}</p>
        </div>
        <div className="dialog-actions">
          <button className="button" onClick={onClose}>
            Close
          </button>
          <button className="button button-primary" disabled={!version} onClick={() => void restore()}>
            Restore this version
          </button>
        </div>
      </header>
      <Segmented<"version" | "changes">
        label="Show"
        value={view}
        options={[
          { value: "version", label: "This version" },
          { value: "changes", label: "Changes since" },
        ]}
        onChange={setView}
      />
      {view === "changes" ? (
        <ChangesView old={body} now={now} tree={tree} workspace={workspace} legend={{ gone: "erased since", changed: "changed since", added: "new since" }} className="version-preview-body" />
      ) : (
        // The serializer escapes every text and attribute, as for a downloaded web page.
        <div className="editor version-preview-body" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
      )}
    </Dialog>
  );
}
