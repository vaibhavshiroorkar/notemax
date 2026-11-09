import { setProp, type Tree, type TreeNode } from "@notemax/core";
import type * as Y from "yjs";
import { dateOf, shiftDay, todayKey } from "./dates";

// A journal is a note that holds one entry per day, newest first, with each
// day written right on its page. New ones come from Create, Others, Journal.
// The Journal made for daily notes (the "dailyFolder" role) is one too.

export const isJournal = (node: TreeNode | undefined) => !!node && node.kind === "note" && (node.props.journal === true || node.props.dailyFolder === true);

/** The settings a new note gets to be a journal. */
export function makeJournal(doc: Y.Doc, id: string) {
  setProp(doc, id, "journal", true);
  setProp(doc, id, "subtopics", "inline");
  setProp(doc, id, "sort", "days");
}

/**
 * The day a new entry is for: the one after the latest entry, so a journal
 * kept every day fills the next one, or today when it has no dated entry yet.
 */
export function nextDayIn(tree: Tree, journalId: string): string {
  let latest: string | null = null;
  for (const item of tree.items.get(journalId)?.children ?? []) {
    const key = dateOf(item);
    if (key && (!latest || key > latest)) latest = key;
  }
  return latest ? shiftDay(latest, 1) : todayKey();
}
