import { createNode, moveNodes, type TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { SubtopicList } from "./SubtopicList";
import { isJournal } from "@/features/dates/journal";
import { JournalAdder } from "@/features/dates/JournalAdder";
import { newestFirst, noteSubtopics, setNewestFirst, setShowsSubtopics, showsSubtopics } from "./subtopics";

/** The open note's subtopics in the right sidebar, to jump between them. */
export function SubtopicsPanel({ app }: { app: AppContext }) {
  const id = app.activeId!;
  const node = app.tree.byId.get(id);
  const list = noteSubtopics(app.tree, id);
  const add = isJournal(node) ? (
    <JournalAdder app={app} journalId={id} onOpen={(to) => app.open(to)} compact />
  ) : (
    <button className="footer-button" onClick={() => app.open(createNode(app.doc, "note", id))}>
      <Icon name="plus" />
      <span>Add subtopic</span>
    </button>
  );
  const top = !!node && newestFirst(node);
  return (
    <div className="subtopics-panel">
      {top && add}
      {list.length ? <SubtopicList list={list} onOpen={(to) => app.open(to)} onMove={(moved, parentId, nextId) => moveNodes(app.doc, [moved], parentId, nextId)} /> : <p className="versions-empty">{isJournal(node) ? "No entries yet." : "No subtopics yet."}</p>}
      {!top && add}
    </div>
  );
}

/** In "This page": whether pages inside a note show on its page as subtopics. */
export function SubtopicSetting({ node, app }: { node: TreeNode; app: AppContext }) {
  return (
    <>
      <SubtopicsOnRow node={node} app={app} />
      {showsSubtopics(node) && !isJournal(node) && (
        <label className="page-info-row">
          <span className="page-info-label">Order</span>
          <span className="page-info-value">
            <input type="checkbox" checked={newestFirst(node)} onChange={(event) => setNewestFirst(app, node.id, event.target.checked)} />
            <span>Newest on top</span>
          </span>
        </label>
      )}
    </>
  );
}

function SubtopicsOnRow({ node, app }: { node: TreeNode; app: AppContext }) {
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
