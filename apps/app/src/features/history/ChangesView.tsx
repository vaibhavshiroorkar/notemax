import { useEffect, useState } from "react";
import type { Tree } from "@notemax/core";
import { dataUrl, loadPictures, resolver } from "@/features/export/content";
import type { DocNode } from "@/features/export/serialize";
import { diffHtml, type DiffResult } from "./diff";
import "./diff.css";
import { Loading } from "@/ui/Spinner";

/** What each color means where it is shown, like "erased since then". */
export interface Legend {
  gone: string;
  added: string;
  changed: string;
}

/** Two versions of a note as one page: red went, green came, yellow was reworded. */
export function ChangesView({ old, now, tree, legend, className = "", workspace }: { old: DocNode | null; now: DocNode | null; tree: Tree; legend: Legend; className?: string; workspace?: string }) {
  const [result, setResult] = useState<DiffResult | null>(null);

  useEffect(() => {
    if (!old || !now) return;
    let live = true;
    void loadPictures([old, now], undefined, workspace).then((pictures) => {
      if (live) setResult(diffHtml(old, now, resolver(tree, (id) => (pictures.has(id) ? dataUrl(pictures.get(id)!) : null))));
    });
    return () => {
      live = false;
    };
  }, [old, now, tree, workspace]);

  if (!result) return <Loading className="diff-legend">Comparing...</Loading>;
  const none = !result.gone && !result.added && !result.changed;
  return (
    <>
      <p className="diff-legend">
        {none ? (
          "No differences."
        ) : (
          // Only the colors this comparison uses.
          ([
            ["gone", result.gone, legend.gone],
            ["changed", result.changed, legend.changed],
            ["new", result.added, legend.added],
          ] as const)
            .filter(([, count]) => count > 0)
            .map(([key, count, words]) => (
              <span key={key} className="diff-key" data-diff={key}>
                {count} {words}
              </span>
            ))
        )}
      </p>
      {/* Every text and attribute is escaped by the serializer and the diff. */}
      <div className={`editor diff-body ${className}`} dangerouslySetInnerHTML={{ __html: result.html }} />
    </>
  );
}
