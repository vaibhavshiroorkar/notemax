import { setProp, type TreeNode } from "@notemax/core";
import { getOption } from "@/plugins/options";
import type { AppContext } from "@/plugins/types";

/** A note's layout in the right sidebar's "This page": one long page, pages, or whatever the setting says. */
export function LayoutSetting({ node, app }: { node: TreeNode; app: AppContext }) {
  const own = node.props.layout === "pages" || node.props.layout === "infinite" ? node.props.layout : "default";
  const byDefault = getOption("notes", "pages") ? "pages" : "long page";
  return (
    <div className="page-info-row">
      <span className="page-info-label">Layout</span>
      <span className="page-info-value">
        <select
          aria-label="Layout of this note"
          value={own}
          onChange={(event) => setProp(app.doc, node.id, "layout", event.target.value === "default" ? null : event.target.value)}
        >
          <option value="default">Default ({byDefault})</option>
          <option value="infinite">One long page</option>
          <option value="pages">Pages</option>
        </select>
      </span>
    </div>
  );
}
