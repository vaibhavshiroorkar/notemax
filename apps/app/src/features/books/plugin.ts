import { ROOT, childrenOf, moveNode } from "@notemax/core";
import type { AppContext, Plugin } from "@/plugins/types";
import { BookPane } from "./BookPane";
import { BookPanel } from "./BookPanel";
import { ChapterFooter } from "./ChapterFooter";
import { bookOf, chapterOf, chapterStops, hostChapter } from "./reading";
import { BookWordCount } from "./WordCount";

/** The chapter one step on (or back) from the open page. From the book's own page, on is its first chapter. */
function stepFrom(app: AppContext, by: 1 | -1): string | undefined {
  const book = bookOf(app.tree, app.activeId);
  if (!book) return undefined;
  const stops = chapterStops(book);
  if (book.id === app.activeId) return by === 1 ? stops[0]?.item.id : undefined;
  const here = stops.findIndex((stop) => stop.item.id === app.activeId);
  return here < 0 ? undefined : stops[here + by]?.item.id;
}

export const booksPlugin: Plugin = {
  id: "books",
  name: "Books",
  description: "Books with chapters, a chapter list on the right and word counts",
  kinds: [{ kind: "book", label: "New book", icon: "book" }],
  pageViews: [{ kind: "book", component: BookPane }],
  sidePanels: [{ id: "books.chapters", title: "Chapters", order: 10, when: (app) => !!bookOf(app.tree, app.activeId), component: BookPanel }],
  pageCorner: [{ id: "books.words", kinds: ["book", "note"], component: BookWordCount }],
  pageFooter: [{ id: "books.steps", kinds: ["note"], component: ChapterFooter }],
  // A subtopic is read inside its chapter's page, so opening one opens the chapter there.
  hostOf: hostChapter,
  settings: [{ id: "books", order: 30, group: "Writing", title: "Books", icon: "book", keywords: ["chapters", "writing"] }],
  contextMenu: [
    {
      id: "books.to-chapter",
      title: "Make it a chapter",
      group: "edit",
      icon: "book",
      targets: ["page"],
      when: (target, app) => target.type === "page" && !!hostChapter(app.tree, target.node.id),
      run(target, app) {
        if (target.type !== "page") return;
        const book = bookOf(app.tree, target.node.id);
        const chapter = chapterOf(app.tree, target.node.id);
        if (!book || !chapter) return;
        // Right after the chapter it came from, so the order still reads.
        moveNode(app.doc, target.node.id, book.id, book.children.indexOf(chapter) + 1);
        app.notify("Made it a chapter");
      },
    },
    {
      id: "books.move-out",
      title: "Move out of book",
      group: "edit",
      icon: "arrow-left",
      targets: ["page"],
      when(target, app) {
        if (target.type !== "page") return false;
        const book = bookOf(app.tree, target.node.id);
        return !!book && book.id !== target.node.id;
      },
      run(target, app) {
        if (target.type !== "page") return;
        const book = bookOf(app.tree, target.node.id);
        if (!book || book.id === target.node.id) return;
        // Beside the book, so a book in a folder keeps the page in that folder.
        const siblings = childrenOf(app.tree, book.parentId);
        moveNode(app.doc, target.node.id, book.parentId, siblings.indexOf(book) + 1);
        app.notify(book.parentId === ROOT ? "Moved out of book to Notes" : "Moved out of book, next to it");
      },
    },
  ],
  options: [
    {
      id: "wordCount",
      label: "Show the word count at the top right",
      description: "On a book, and on each chapter as its share of the book",
      section: "books",
      quick: true,
      default: true,
    },
  ],
  commands: [
    { id: "books.new", title: "New book", keywords: ["create", "add", "write"], run: (app) => app.create("book") },
    { id: "books.next", title: "Next chapter", keywords: ["book", "subtopic", "forward"], when: (app) => !!stepFrom(app, 1), run: (app) => app.open(stepFrom(app, 1)!) },
    { id: "books.previous", title: "Previous chapter", keywords: ["book", "subtopic", "back"], when: (app) => !!stepFrom(app, -1), run: (app) => app.open(stepFrom(app, -1)!) },
  ],
};
