import type { CSSProperties } from "react";
import { renameNode, type TreeItem } from "@notemax/core";
import { InlineNote } from "@/features/editor/InlineNote";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { LazyMount } from "@/ui/LazyMount";
import { BookItemMenu } from "./BookItemMenu";
import { chapterStops, subtopicsOf } from "./reading";

/** One piece of the book: its number, a title to edit in place, and its text. */
function Piece({ item, label, depth, props }: { item: TreeItem; label: string; depth: number; props: PageProps }) {
  const { workspaceDoc, hub, onSelect } = props;
  const untitled = "Untitled";
  // A subtopic is read in its chapter's page, so its arrow goes there.
  const where = depth > 0 ? "in its chapter" : "on its own page";
  return (
    <section className="whole-piece" style={{ "--depth": depth } as CSSProperties} aria-label={`${label} ${item.title || untitled}`}>
      <header className="whole-title">
        <span className="chapter-number">{label}</span>
        <input value={item.title} placeholder={untitled} aria-label={`Title of ${label}`} onChange={(event) => renameNode(workspaceDoc, item.id, event.target.value)} />
        <button className="icon-button" aria-label={`Open ${item.title || untitled} ${where}`} title={`Open ${where}`} onClick={() => onSelect(item.id)}>
          <Icon name="arrow-right" />
        </button>
        <BookItemMenu node={item} />
      </header>
      {item.kind === "note" ? (
        <LazyMount>
          <InlineNote id={item.id} hub={hub} workspaceDoc={workspaceDoc} />
        </LazyMount>
      ) : (
        <button className="link-button" onClick={() => onSelect(item.id)}>
          Open this {item.kind === "board" ? "board" : "page"}
        </button>
      )}
    </section>
  );
}

/**
 * The whole book on one page: every chapter and subtopic in reading
 * order, each edited in place. Each stays a page of its own underneath, so
 * going back to the chapter list loses nothing. Pieces far down the page load
 * as they come near, so a long book opens fast.
 */
export function WholeBook({ book, props }: { book: TreeItem; props: PageProps }) {
  return (
    <div className="whole-book">
      {chapterStops(book).map(({ item, label }) => [
        <Piece key={item.id} item={item} label={label} depth={0} props={props} />,
        ...subtopicsOf(item, label).map((sub) => <Piece key={sub.item.id} item={sub.item} label={sub.label} depth={sub.depth} props={props} />),
      ])}
    </div>
  );
}
