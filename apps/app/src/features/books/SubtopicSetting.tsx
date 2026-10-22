import { setProp, type TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { chapterOf } from "./reading";

/** On a chapter, in the right sidebar's "This page": its subtopics on pages of their own, or all in the chapter's page. */
export function SubtopicSetting({ node, app }: { node: TreeNode; app: AppContext }) {
  if (chapterOf(app.tree, node.id)?.id !== node.id) return null;
  return (
    <div className="page-info-row">
      <span className="page-info-label">Subtopics</span>
      <span className="page-info-value">
        <select
          aria-label="Where this chapter's subtopics show"
          value={node.props.subtopics === "together" ? "together" : "apart"}
          onChange={(event) => setProp(app.doc, node.id, "subtopics", event.target.value === "together" ? "together" : null)}
        >
          <option value="apart">Each on its own page</option>
          <option value="together">All in this page</option>
        </select>
      </span>
    </div>
  );
}
