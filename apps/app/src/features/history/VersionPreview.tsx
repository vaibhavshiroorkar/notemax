import { useEffect, useState } from "react";
import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { listVersions, restoreBody, versionDoc, type Version } from "@notemax/core";
import { dataUrl, loadPictures, resolver, withPageDoc } from "@/features/export/content";
import { toHtml, type DocNode } from "@/features/export/serialize";
import { getStore } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { saveNow } from "./versions";
import { whenOf } from "./VersionsPanel";

/** One saved version, read-only, with a button to make the page say that again. */
export function VersionPreview({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const pageId = options.pageId as string;
  const versionId = options.versionId as string;
  const [version, setVersion] = useState<Version | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = (await listVersions(await getStore(), pageId)).find((v) => v.id === versionId) ?? null;
      if (!found || !live) return setVersion(null);
      const doc = versionDoc(found);
      const body = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")) as DocNode;
      doc.destroy();
      const pictures = await loadPictures([body]);
      if (!live) return;
      setVersion(found);
      setHtml(toHtml(body.content ?? [], resolver(app.tree, (id) => (pictures.has(id) ? dataUrl(pictures.get(id)!) : null))));
    })().catch(() => live && setHtml(""));
    return () => {
      live = false;
    };
  }, [pageId, versionId, app.tree]);

  const restore = async () => {
    if (!version) return;
    // How the page is now becomes a version first, so the restore can be taken back too.
    const now = await withPageDoc(pageId, (doc) => Y.encodeStateAsUpdate(doc));
    await saveNow(pageId, now);
    await withPageDoc(pageId, (doc) => restoreBody(doc, version));
    app.notify(`Restored the version from ${whenOf(version.time)}`);
    onClose();
  };

  const title = app.tree.byId.get(pageId)?.title || "Untitled";
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
      {/* The serializer escapes every text and attribute, as for a downloaded web page. */}
      <div className="editor version-preview-body" dangerouslySetInnerHTML={{ __html: html ?? "" }} />
    </Dialog>
  );
}
