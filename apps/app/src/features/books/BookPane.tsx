import { useEffect, type CSSProperties } from "react";
import { createNode, renameNode, setProp } from "@notemax/core";
import { InlineNote } from "@/features/editor/InlineNote";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Segmented } from "@/ui/Segmented";
import { pageMenu } from "@/ui/ContextMenu";
import { BookItemMenu } from "./BookItemMenu";
import { ChapterPreview } from "./ChapterPreview";
import { WholeBook } from "./WholeBook";
import { allStops, bookWords, chapterStops, subtopicsOf } from "./reading";
import { useWordBackfill } from "./useWordBackfill";
import "./books.css";

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// How much of each chapter the book's page shows: titles only (the first
// choice), the first lines of each, or every chapter written out.
type BookView = "titles" | "previews" | "whole";
const VIEWS: { value: BookView; label: string }[] = [
  { value: "titles", label: "Titles" },
  { value: "previews", label: "Previews" },
  { value: "whole", label: "Full text" },
];

export function BookPane(props: PageProps) {
  const { node, app, tree, workspaceDoc, hub, onSelect, onStatus, onReady } = props;
  // A page setting, so the choice syncs with the book and each book keeps its own.
  const view: BookView = node.props.bookView === "whole" ? "whole" : node.props.bookView === "previews" ? "previews" : "titles";
  const book = tree.items.get(node.id);
  const chapters = book ? chapterStops(book) : [];
  useWordBackfill(
    (book ? allStops(book) : []).flatMap(({ item }) => (item.kind === "note" ? [item] : [])),
    workspaceDoc,
  );

  // The description saves itself like any note; the page around it has nothing waiting.
  useEffect(() => {
    onStatus({ state: "saved" });
    onReady();
  }, [onStatus, onReady]);

  const total = book ? bookWords(book) : 0;

  return (
    <article className="note book">
      <input
        className="note-title"
        value={node.title}
        placeholder="Untitled book"
        aria-label="Book title"
        autoFocus={node.title === ""}
        onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
      />
      <PageHeader node={node} app={app} />
      <div className="book-bar">
        <p className="book-summary">
          {plural(chapters.length, "chapter")}
          {chapters.length > 0 && `, ${total !== null ? plural(total, "word") : "counting words..."}`}
        </p>
        {chapters.length > 0 && (
          <Segmented<BookView> label="Show the book as" value={view} options={VIEWS} onChange={(next) => setProp(workspaceDoc, node.id, "bookView", next === "titles" ? null : next)} />
        )}
      </div>

      <div className="book-description">
        <InlineNote id={node.id} hub={hub} workspaceDoc={workspaceDoc} placeholder="Write a description of the book..." />
      </div>

      {book && view === "whole" && chapters.length > 0 ? (
        <WholeBook book={book} props={props} />
      ) : chapters.length > 0 ? (
        <ol className="chapter-list" data-view={view} aria-label="Chapters">
          {chapters.map(({ item, label }) => [
            <li key={item.id} onContextMenu={pageMenu(item)}>
              <button className="chapter" onClick={() => onSelect(item.id)}>
                <span className="chapter-number">{label}</span>
                <span className="chapter-title">{item.title || "Untitled"}</span>
                <span className="chapter-words">
                  {item.kind === "board" ? "Board" : item.kind === "note" && item.words !== null ? plural(item.words, "word") : ""}
                </span>
              </button>
              <BookItemMenu node={item} />
              {view === "previews" && item.kind === "note" && <ChapterPreview item={item} workspace={app.workspace} />}
            </li>,
            ...subtopicsOf(item, label).map((sub) => (
              <li key={sub.item.id} style={{ "--depth": sub.depth } as CSSProperties} onContextMenu={pageMenu(sub.item)}>
                <button className="chapter" onClick={() => onSelect(sub.item.id)}>
                  <span className="chapter-number">{sub.label}</span>
                  <span className="chapter-title">{sub.item.title || "Untitled"}</span>
                  <span className="chapter-words">{sub.item.kind === "note" && sub.item.words !== null ? plural(sub.item.words, "word") : ""}</span>
                </button>
                <BookItemMenu node={sub.item} />
              </li>
            )),
          ])}
        </ol>
      ) : (
        <p className="book-empty">No chapters yet. Drag notes or boards onto the book in the sidebar, or add a new one.</p>
      )}

      <div className="book-actions">
        <button className="button add-chapter" onClick={() => onSelect(createNode(workspaceDoc, "note", node.id))}>
          <Icon name="plus" />
          <span>Add chapter</span>
        </button>
      </div>
    </article>
  );
}
