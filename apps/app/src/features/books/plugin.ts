import type { AppContext, Plugin } from "@/plugins/types";
import { BookPane } from "./BookPane";
import { BookPanel } from "./BookPanel";
import { ChapterFooter } from "./ChapterFooter";
import { bookOf, readingStops } from "./reading";
import { SubtopicSetting } from "./SubtopicSetting";
import { BookWordCount } from "./WordCount";

/** The chapter or subtopic one step on (or back) from the open page. From the book's own page, on is its first chapter. */
function stepFrom(app: AppContext, by: 1 | -1): string | undefined {
  const book = bookOf(app.tree, app.activeId);
  if (!book) return undefined;
  const stops = readingStops(book);
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
  pageSettings: [{ id: "books.subtopics", kinds: ["note"], component: SubtopicSetting }],
  settings: [{ id: "books", order: 30, group: "Writing", title: "Books", icon: "book", keywords: ["chapters", "writing"] }],
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
