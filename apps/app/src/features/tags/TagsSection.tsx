import { useState } from "react";
import type { AppContext } from "@/plugins/types";
import { tagFilter, toggleTagFilter } from "./filter";

// Enough to scan at a glance. The rest are one click away.
const SHOWN = 12;

/** Every tag in the sidebar, most used first. Click to filter, click again to stop. */
export function TagsSection({ app }: { app: AppContext }) {
  const active = tagFilter.use();
  const [all, setAll] = useState(false);
  const tags = app.tree.tags;
  if (!tags.length) return null;
  // A tag in the filter stays visible even when it is past the cut.
  const shown = all ? tags : tags.filter(({ tag }, i) => i < SHOWN || active.includes(tag));

  return (
    <section className="section tags-section">
      <header className="section-header">
        <span>Tags</span>
      </header>
      <div className="tag-cloud">
        {shown.map(({ tag, count }) => (
          <button key={tag} className="tag-toggle" aria-pressed={active.includes(tag)} onClick={() => toggleTagFilter(tag)}>
            #{tag}
            <span className="tag-count">{count}</span>
          </button>
        ))}
        {tags.length > SHOWN && (
          <button className="tag-more" onClick={() => setAll(!all)}>
            {all ? "Fewer" : `All ${tags.length}`}
          </button>
        )}
      </div>
    </section>
  );
}
