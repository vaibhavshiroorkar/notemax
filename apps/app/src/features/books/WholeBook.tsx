import type { CSSProperties } from "react";
import { renameNode, type TreeItem } from "@notemax/core";
import { InlineNote } from "@/features/editor/InlineNote";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { LazyMount } from "@/ui/LazyMount";
import { BookItemMenu } from "./BookItemMenu";
import { readingOrder, subtopicsOf } from "./reading";

/** One piece of the book: its number, a title to edit in place, and its text. */
function Piece({ item, label, depth, part, props }: { item: TreeItem; label: string | null; depth: number; part?: boolean; props: PageProps }) {
  const { workspaceDoc, hub, onSelect } = props;
  const untitled = part ? "Untitled part" : "Untitled";
  return (
    <section className="whole-piece" data-part={part || undefined} style={{ "--depth": depth } as CSSProperties} aria-label={`${label ?? ""} ${item.title || untitled}`.trim()}>
      <header className="whole-title">
        {label ? <span className="chapter-number">{label}</span> : <Icon name="book" />}
        <input value={item.title} placeholder={untitled} aria-label={`Title of ${label ?? item.title ?? untitled}`} onChange={(event) => renameNode(workspaceDoc, item.id, event.target.value)} />
        <button className="icon-button" aria-label={`Open ${item.title || untitled} on its own page`} title="Open on its own page" onClick={() => onSelect(item.id)}>
          <Icon name="arrow-right" />
        </button>
        <BookItemMenu node={item} />
      </header>
      {item.kind === "note" || item.kind === "book" ? (
        <LazyMount>
          <InlineNote id={item.id} hub={hub} workspaceDoc={workspaceDoc} placeholder={part ? "A few words about this part..." : "Write here..."} />
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
 * The whole book on one page: every part, chapter and subtopic in reading
 * order, each edited in place. Each stays a page of its own underneath, so
 * going back to the chapter list loses nothing. Pieces far down the page load
 * as they come near, so a long book opens fast.
 */
export function WholeBook({ book, props }: { book: TreeItem; props: PageProps }) {
  return (
    <div className="whole-book">
      {readingOrder(book).map(({ item, depth, number }) =>
        number === null ? (
          <Piece key={item.id} item={item} label={null} depth={depth} part props={props} />
        ) : (
          [
            <Piece key={item.id} item={item} label={String(number)} depth={depth} props={props} />,
            ...subtopicsOf(item, String(number)).map((sub) => <Piece key={sub.item.id} item={sub.item} label={sub.label} depth={depth + sub.depth} props={props} />),
          ]
        ),
      )}
    </div>
  );
}
