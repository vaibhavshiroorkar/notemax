import { useEffect, useState } from "react";
import { yXmlFragmentToProsemirrorJSON } from "@tiptap/y-tiptap";
import { listVersions, versionDoc, type Tree, type Version } from "@notemax/core";
import { dataUrl, loadPictures, resolver } from "@/features/export/content";
import { toHtml, type DocNode } from "@/features/export/serialize";
import { getStore } from "@/platform/platform";

/**
 * One saved version of a page and its body as HTML, to show read-only. The
 * serializer escapes every text and attribute, as for a downloaded web page.
 * Both are null while loading, and stay null when the version is gone.
 */
export function useVersionHtml(pageId: string, versionId: string, tree: Tree) {
  const [version, setVersion] = useState<Version | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const found = (await listVersions(await getStore(), pageId)).find((v) => v.id === versionId) ?? null;
      if (!found || !live) return;
      const doc = versionDoc(found);
      const body = yXmlFragmentToProsemirrorJSON(doc.getXmlFragment("content")) as DocNode;
      doc.destroy();
      const pictures = await loadPictures([body]);
      if (!live) return;
      setVersion(found);
      setHtml(toHtml(body.content ?? [], resolver(tree, (id) => (pictures.has(id) ? dataUrl(pictures.get(id)!) : null))));
    })().catch(() => live && setHtml(""));
    return () => {
      live = false;
    };
  }, [pageId, versionId, tree]);

  return { version, html };
}
