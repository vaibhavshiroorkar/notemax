import type { TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { bookOf, readingStops, type Stop } from "./reading";

const name = (stop: Stop) => stop.item.title || "Untitled";

/** At the end of a chapter or subtopic: on to the next one, or back to the one before, each with an arrow pointing its way. */
export function ChapterFooter({ node, app }: { node: TreeNode; app: AppContext }) {
  const book = bookOf(app.tree, node.id);
  if (!book || book.id === node.id) return null;
  const stops = readingStops(book);
  const here = stops.findIndex((stop) => stop.item.id === node.id);
  // A subtopic shown inside its chapter's page is read from there.
  if (here < 0) return null;
  const previous = stops[here - 1];
  const next = stops[here + 1];

  return (
    <nav className="chapter-footer" aria-label="Next and previous">
      {previous ? (
        <button className="chapter-step" data-step="previous" onClick={() => app.open(previous.item.id)}>
          <Icon name="arrow-left" />
          <span className="chapter-step-text">
            <span className="chapter-step-hint">Previous</span>
            <span className="chapter-step-title">
              <span className="chapter-number">{previous.label}</span> {name(previous)}
            </span>
          </span>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button className="chapter-step" data-step="next" onClick={() => app.open(next.item.id)}>
          <span className="chapter-step-text">
            <span className="chapter-step-hint">Next</span>
            <span className="chapter-step-title">
              <span className="chapter-number">{next.label}</span> {name(next)}
            </span>
          </span>
          <Icon name="arrow-right" />
        </button>
      ) : (
        <button className="chapter-step" data-step="next" onClick={() => app.open(book.id)}>
          <span className="chapter-step-text">
            <span className="chapter-step-hint">The end</span>
            <span className="chapter-step-title">Back to {book.title || "Untitled book"}</span>
          </span>
          <Icon name="book" />
        </button>
      )}
    </nav>
  );
}
