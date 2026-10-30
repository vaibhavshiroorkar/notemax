import { useEffect, useState, type CSSProperties } from "react";
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
import { allStops, bookViewOf, bookWords, chapterNoun, chapterNumbersOf, chapterStops, subtopicsOf, type BookView, type ChapterNumbers } from "./reading";
import { useWordBackfill } from "./useWordBackfill";
import "./books.css";
import { plural } from "@/ui/format";

const VIEWS: { value: BookView; label: string }[] = [
  { value: "chapters", label: "Chapters" },
  { value: "titles", label: "Outline" },
  { value: "previews", label: "Previews" },
  { value: "whole", label: "Full text" },
];

const NUMBERS: { value: ChapterNumbers; label: string }[] = [
  { value: "numbers", label: "1, 2, 3" },
  { value: "roman", label: "I, II, III" },
  { value: "none", label: "None" },
];

/** What the book calls its chapters and how it numbers them. Saved on the book, so it syncs. */
function ChapterStyle({ node, workspaceDoc }: Pick<PageProps, "node" | "workspaceDoc">) {
  const word = typeof node.props.chapterWord === "string" ? node.props.chapterWord : "Chapter";
  return (
    <div className="book-style" role="group" aria-label="Chapter names and numbers">
      <label className="book-style-field">
        <span>Name</span>
        <input
          value={word}
          placeholder="No name"
          maxLength={24}
          aria-label="What to call a chapter"
          onChange={(event) => setProp(workspaceDoc, node.id, "chapterWord", event.target.value === "Chapter" ? null : event.target.value)}
        />
      </label>
      <div className="book-style-field">
        <span>Numbers</span>
        <Segmented<ChapterNumbers>
          label="Chapter numbers"
          value={chapterNumbersOf(node)}
          options={NUMBERS}
          onChange={(next) => setProp(workspaceDoc, node.id, "chapterNumbers", next === "numbers" ? null : next)}
        />
      </div>
    </div>
  );
}

export function BookPane(props: PageProps) {
  const { node, app, tree, workspaceDoc, hub, onSelect, onStatus, onReady } = props;
  const view = bookViewOf(node);
  const chaptersOnly = view === "chapters";
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
  const [styling, setStyling] = useState(false);

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
          {chapters.length.toLocaleString()} {chapterNoun(node, chapters.length !== 1)}
          {chapters.length > 0 && `, ${total !== null ? plural(total, "word") : "counting words..."}`}
        </p>
        <div className="book-bar-tools">
          {chapters.length > 0 && (
            <Segmented<BookView>
              label="Show the book as"
              value={view}
              options={VIEWS}
              onChange={(next) => {
                setProp(workspaceDoc, node.id, "bookView", next === "titles" ? null : next);
                // The old Chapters only flag would otherwise pull Outline back to Chapters.
                if (node.props.bookSubtopics) setProp(workspaceDoc, node.id, "bookSubtopics", null);
              }}
            />
          )}
          <button className="icon-button" aria-label="Chapter names and numbers" aria-expanded={styling} title="Chapter names and numbers" onClick={() => setStyling(!styling)}>
            <Icon name="list-number" />
          </button>
        </div>
      </div>
      {styling && <ChapterStyle node={node} workspaceDoc={workspaceDoc} />}

      <div className="book-description">
        <InlineNote id={node.id} hub={hub} workspaceDoc={workspaceDoc} placeholder="Write a description of the book..." />
      </div>

      {book && view === "whole" && chapters.length > 0 ? (
        <WholeBook book={book} props={props} />
      ) : chapters.length > 0 ? (
        <ol className="chapter-list" data-view={view} aria-label={chapterNoun(node, true)}>
          {chapters.map(({ item, label }) => [
            <li key={item.id} data-reveal={item.id} onContextMenu={pageMenu(item)}>
              <button className="chapter" onClick={() => onSelect(item.id)}>
                {label && <span className="chapter-number">{label}</span>}
                <span className="chapter-title">{item.title || "Untitled"}</span>
                <span className="chapter-words">
                  {item.kind === "board" ? "Board" : item.kind === "note" && item.words !== null ? plural(item.words, "word") : ""}
                </span>
              </button>
              <BookItemMenu node={item} />
              {view === "previews" && item.kind === "note" && <ChapterPreview item={item} workspace={app.workspace} />}
            </li>,
            ...(chaptersOnly ? [] : subtopicsOf(item, label)).map((sub) => (
              <li key={sub.item.id} data-reveal={sub.item.id} style={{ "--depth": sub.depth } as CSSProperties} onContextMenu={pageMenu(sub.item)}>
                <button className="chapter" onClick={() => onSelect(sub.item.id)}>
                  {sub.label && <span className="chapter-number">{sub.label}</span>}
                  <span className="chapter-title">{sub.item.title || "Untitled"}</span>
                  <span className="chapter-words">{sub.item.kind === "note" && sub.item.words !== null ? plural(sub.item.words, "word") : ""}</span>
                </button>
                <BookItemMenu node={sub.item} />
              </li>
            )),
          ])}
        </ol>
      ) : (
        <p className="book-empty">No {chapterNoun(node, true)} yet. Drag notes or boards onto the book in the sidebar, or add a new one.</p>
      )}

      <div className="book-actions">
        <button className="button add-chapter" onClick={() => onSelect(createNode(workspaceDoc, "note", node.id))}>
          <Icon name="plus" />
          <span>Add {chapterNoun(node)}</span>
        </button>
      </div>
    </article>
  );
}
