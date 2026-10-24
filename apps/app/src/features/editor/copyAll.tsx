import type { TreeNode } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { loadBody, resolver } from "@/features/export/content";
import { toHtml, toPlainText } from "@/features/export/serialize";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { registry } from "@/plugins/registry";

/**
 * Puts a whole note on the clipboard: as formatted text for apps that take it,
 * like Word or an email, and as plain text for the rest. Links to other pages
 * become their titles.
 */
export async function copyAll(app: AppContext, id: string) {
  const node = app.tree.byId.get(id);
  if (registry.hidesText(node)) return app.notify("This page is locked. Open it first.");
  try {
    // Edits are saved in batches; the last keystrokes may not be stored yet.
    await peekDoc(id, app.workspace)?.flush();
    const body = await loadBody(id, app.workspace);
    const r = resolver(app.tree);
    const text = toPlainText(body, r);
    const html = toHtml(body.content ?? [], r);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
    } else await navigator.clipboard.writeText(text);
    app.notify(`Copied all of "${node?.title || "Untitled"}"`);
  } catch (error) {
    app.notify(`Could not copy: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** At the top right of a note, and on a phone too, where selecting a long note by hand is slow. */
export function CopyAllButton({ node, app }: { node: TreeNode; app: AppContext }) {
  return (
    <button className="icon-button copy-all-button" aria-label="Copy all" title="Copy all of this note" onClick={() => void copyAll(app, node.id)}>
      <Icon name="copy" />
    </button>
  );
}
