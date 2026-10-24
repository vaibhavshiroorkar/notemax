import { createNode, type TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { SubtopicList } from "./SubtopicList";
import { noteSubtopics, setShowsSubtopics, showsSubtopics } from "./subtopics";

/** The open note's subtopics in the right sidebar, to jump between them. */
export function SubtopicsPanel({ app }: { app: AppContext }) {
  const id = app.activeId!;
  const list = noteSubtopics(app.tree, id);
  return (
    <div className="subtopics-panel">
      {list.length ? <SubtopicList list={list} onOpen={(to) => app.open(to)} /> : <p className="versions-empty">No subtopics yet.</p>}
      <button className="footer-button" onClick={() => app.open(createNode(app.doc, "note", id))}>
        <Icon name="plus" />
        <span>Add subtopic</span>
      </button>
    </div>
  );
}

/** In "This page": whether pages inside a note show on its page as subtopics. */
export function SubtopicSetting({ node, app }: { node: TreeNode; app: AppContext }) {
  return (
    <label className="page-info-row">
      <span className="page-info-label">Subtopics</span>
      <span className="page-info-value">
        <input type="checkbox" checked={showsSubtopics(node)} onChange={(event) => setShowsSubtopics(app, node.id, event.target.checked)} />
        <span>Pages inside show here</span>
      </span>
    </label>
  );
}
