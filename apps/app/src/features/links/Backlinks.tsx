import type { AppContext } from "@/plugins/types";
import "./links.css";

/** The pages that link to the open one, in the right sidebar. */
export function BacklinksPanel({ app }: { app: AppContext }) {
  const { tree, hub, activeId } = app;
  const sources = (activeId && tree.backlinks.get(activeId)) || [];
  return (
    <div className="backlinks" aria-label="Backlinks">
      {sources.length === 0 ? (
        <p className="backlinks-empty">No links here yet. Type [[ in a note to link one.</p>
      ) : (
        <ul className="backlinks-list">
          {sources.map((source) => (
            <li key={source.id}>
              <button className="backlink" onClick={() => hub.follow(source.id)}>
                <span className="backlink-title">{source.title || "Untitled"}</span>
                <span className="backlink-where">{hub.where(source.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
