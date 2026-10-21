import type { Plugin } from "@/plugins/types";
import { BookPane } from "./BookPane";
import { BookPanel } from "./BookPanel";
import { bookOf } from "./book-of";

export const booksPlugin: Plugin = {
  id: "books",
  name: "Books",
  kinds: [{ kind: "book", label: "New book", icon: "book" }],
  pageViews: [{ kind: "book", component: BookPane }],
  sidePanels: [{ id: "books.chapters", title: "chapters", when: (app) => !!bookOf(app.tree, app.activeId), component: BookPanel }],
  commands: [{ id: "books.new", title: "New book", keywords: ["create", "add", "write"], run: (app) => app.create("book") }],
};
