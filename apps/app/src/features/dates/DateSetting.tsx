import type { TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { dateOf, setDate } from "./dates";

/** A page's date in the right sidebar's "This page", which puts it on the calendar. */
export function DateSetting({ node, app }: { node: TreeNode; app: AppContext }) {
  const value = dateOf(node) ?? "";
  return (
    <div className="page-info-row">
      <span className="page-info-label">Date</span>
      <span className="page-info-value date-value">
        <input type="date" aria-label="Date of this page" value={value} onChange={(event) => setDate(app, node.id, event.target.value || null)} />
        {value && node.props.daily === undefined && (
          <button className="link-button" onClick={() => setDate(app, node.id, null)}>
            Clear
          </button>
        )}
      </span>
    </div>
  );
}
