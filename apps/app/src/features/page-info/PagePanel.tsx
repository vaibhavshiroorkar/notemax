import type { ReactNode } from "react";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Safe } from "@/ui/Safe";

const KIND_NAMES: Record<string, string> = { note: "Note", book: "Book", board: "Board", folder: "Folder" };

const dateOf = (time: number) => new Date(time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** "5 min ago" for the last day, then the date. Edits are kept to the minute. */
function sinceOf(time: number): string {
  const minutes = Math.floor((Date.now() - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return dateOf(time);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="page-info-row">
      <span className="page-info-label">{label}</span>
      <span className="page-info-value">{children}</span>
    </div>
  );
}

/** "This page" in the right sidebar: what the open page is, and its own settings from plugins. */
export function PagePanel({ app }: { app: AppContext }) {
  const node = app.activeId ? app.tree.byId.get(app.activeId) : undefined;
  if (!node) return null;
  const linkedFrom = app.tree.backlinks.get(node.id)?.length ?? 0;
  return (
    <div className="page-info">
      <Row label="Kind">{KIND_NAMES[node.kind] ?? node.kind}</Row>
      <Row label="Created">{dateOf(node.createdAt)}</Row>
      <Row label="Edited">
        <span title={dateOf(node.editedAt)}>{sinceOf(node.editedAt)}</span>
      </Row>
      {node.words !== null && <Row label="Words">{node.words.toLocaleString()}</Row>}
      <Row label="Links">
        {node.links.length} out, {linkedFrom} in
      </Row>
      {registry.pageSettings(node.kind).map(({ id, component: Setting }) => (
        <Safe key={id} name={id}>
          <Setting node={node} app={app} />
        </Safe>
      ))}
    </div>
  );
}
