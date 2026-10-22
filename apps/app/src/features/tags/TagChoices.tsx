import type { AppContext } from "@/plugins/types";
import { tagFilter, toggleTagFilter } from "./filter";

/** The tags in the sidebar's filter panel. Each one narrows the list; click again to drop it. */
export function TagChoices({ app }: { app: AppContext }) {
  const active = tagFilter.use();
  const tags = app.tree.tags;
  if (!tags.length) return null;
  return (
    <fieldset>
      <legend>Tags</legend>
      <div className="tag-cloud filter-tags">
        {tags.map(({ tag, count }) => (
          <button key={tag} className="tag-toggle" aria-pressed={active.includes(tag)} onClick={() => toggleTagFilter(tag)}>
            #{tag}
            <span className="tag-count">{count}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
