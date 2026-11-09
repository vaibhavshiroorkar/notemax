import { ROOT, childrenOf, moveNode, setProp } from "@notemax/core";
import type { AppContext, Plugin } from "@/plugins/types";
import { BookPane } from "./BookPane";
import { BookPanel } from "./BookPanel";
import { ChapterFooter } from "./ChapterFooter";
import { bookOf, chapterNumbersOf, chapterOf, chapterStops, hostChapter, isUnnumbered } from "./reading";
import { PageWordCount } from "./WordCount";

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
  sideFooter: [{ id: "books.words", kinds: ["book", "note"], component: PageWordCount }],
  pageFooter: [{ id: "books.steps", kinds: ["note"], component: ChapterFooter }],
  // A subtopic is read inside its chapter's page, so opening one opens the chapter there.
  hostOf: hostChapter,
  settings: [{ id: "books", order: 30, group: "Writing", title: "Books", icon: "book", keywords: ["chapters", "writing"] }],
  contextMenu: [
    {
      id: "books.unnumbered",
      title: "Leave without a number",
      group: "layout",
      icon: "list-number",
      targets: ["page"],
      // A chapter of a book that numbers its chapters: a prologue or an interlude can go without.
      when(target, app) {
        if (target.type !== "page" || isUnnumbered(target.node)) return false;
        const parent = app.tree.items.get(target.node.parentId);
        return parent?.kind === "book" && chapterNumbersOf(parent) !== "none";
      },
      run: (target, app) => target.type === "page" && setProp(app.doc, target.node.id, "unnumbered", true),
    },
    {
      id: "books.numbered",
      title: "Give it a number",
      group: "layout",
      icon: "list-number",
      targets: ["page"],
      when: (target, app) => target.type === "page" && isUnnumbered(target.node) && app.tree.items.get(target.node.parentId)?.kind === "book",
      run: (target, app) => target.type === "page" && setProp(app.doc, target.node.id, "unnumbered", null),
    },
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
      label: "Show the word count",
      description: "At the bottom right of the right sidebar. A chapter shows its share of the book.",
      section: "books",
      quick: true,
      default: true,
    },
  ],
  commands: [
    { id: "books.new", title: "New book", keywords: ["create", "add", "write"], run: (app) => app.create("book") },
    { id: "books.next", title: "Next chapter", keywords: ["book", "subtopic", "forward"], shortcut: "Alt+PageDown", when: (app) => !!stepFrom(app, 1), run: (app) => app.open(stepFrom(app, 1)!) },
    { id: "books.previous", title: "Previous chapter", keywords: ["book", "subtopic", "back"], shortcut: "Alt+PageUp", when: (app) => !!stepFrom(app, -1), run: (app) => app.open(stepFrom(app, -1)!) },
  ],
};
