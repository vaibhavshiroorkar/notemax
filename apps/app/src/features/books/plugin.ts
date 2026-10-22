import type { Plugin } from "@/plugins/types";
import { BookPane } from "./BookPane";
import { BookPanel } from "./BookPanel";
import { bookOf } from "./book-of";
import { BookWordCount } from "./WordCount";

export const booksPlugin: Plugin = {
  id: "books",
  name: "Books",
  description: "Books with chapters, a chapter list on the right and word counts",
  kinds: [{ kind: "book", label: "New book", icon: "book" }],
  pageViews: [{ kind: "book", component: BookPane }],
  sidePanels: [{ id: "books.chapters", title: "Chapters", order: 10, when: (app) => !!bookOf(app.tree, app.activeId), component: BookPanel }],
  pageCorner: [{ id: "books.words", kinds: ["book", "note"], component: BookWordCount }],
  settings: [{ id: "books", order: 30, title: "Books", icon: "book", keywords: ["chapters", "writing"] }],
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
  commands: [{ id: "books.new", title: "New book", keywords: ["create", "add", "write"], run: (app) => app.create("book") }],
};
