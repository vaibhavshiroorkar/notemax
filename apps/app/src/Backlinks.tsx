import type { Tree } from "@notemax/core";
import type { LinkHub } from "./links/link-hub";

/** The notes that link to this one, shown under the body. */
export function Backlinks({ tree, noteId, hub }: { tree: Tree; noteId: string; hub: LinkHub }) {
  const sources = tree.backlinks.get(noteId) ?? [];
  return (
    <section className="backlinks" aria-label="Backlinks">
      <h2 className="backlinks-heading">
        {sources.length ? `Linked from ${sources.length} ${sources.length === 1 ? "note" : "notes"}` : "Linked from"}
      </h2>
      {sources.length === 0 ? (
        <p className="backlinks-empty">No notes link here yet. Type [[ in another note to link to this one.</p>
      ) : (
        <ul className="backlinks-list">
          {sources.map((source) => (
            <li key={source.id}>
              <button className="backlink" onClick={() => hub.open(source.id)}>
                <span className="backlink-title">{source.title || "Untitled"}</span>
                <span className="backlink-where">{hub.where(source.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
