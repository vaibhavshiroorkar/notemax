import { useEffect, useRef, useState } from "react";
import { addTag, normalizeTag, removeTag, type TreeNode } from "@notemax/core";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { SuggestionList, type SuggestionListHandle } from "@/ui/suggestion/SuggestionList";
import { addTagRequests, tagFilter } from "./filter";
import "./tags.css";

type Suggestion = { tag: string; count: number | null };

/** Tags under the title of a note or book. Clicking one filters the sidebar by it. */
export function TagBar({ node, app }: { node: TreeNode; app: AppContext }) {
  const [adding, setAdding] = useState(false);
  const requests = addTagRequests.use();
  const firstRequest = useRef(requests);
  useEffect(() => {
    if (requests !== firstRequest.current) setAdding(true);
  }, [requests]);

  return (
    <div className="tag-bar" role="group" aria-label="Tags">
      {node.tags.map((tag) => (
        <span key={tag} className="tag-chip">
          <button
            className="tag-name"
            title={`Show everything tagged #${tag}`}
            onClick={() => {
              tagFilter.set([tag]);
              app.showSidebar();
            }}
          >
            #{tag}
          </button>
          <button className="tag-remove" aria-label={`Remove tag ${tag}`} title="Remove tag" onClick={() => removeTag(app.doc, node.id, tag)}>
            <Icon name="close" />
          </button>
        </span>
      ))}
      {adding ? (
        <TagInput node={node} app={app} onDone={() => setAdding(false)} />
      ) : (
        <button className="tag-add" onClick={() => setAdding(true)}>
          <Icon name="plus" />
          <span>{node.tags.length ? "Tag" : "Add tag"}</span>
        </button>
      )}
    </div>
  );
}

function TagInput({ node, app, onDone }: { node: TreeNode; app: AppContext; onDone(): void }) {
  const [draft, setDraft] = useState("");
  const list = useRef<SuggestionListHandle>(null);
  // Removing a focused input can fire blur, which would save what Esc meant to drop.
  const cancelled = useRef(false);
  const typed = normalizeTag(draft);

  // Existing tags come first, so Enter on "po" picks "poetry" instead of making a
  // near-duplicate. A new tag is the last choice, one arrow press away.
  const existing = app.tree.tags
    .filter(({ tag }) => !node.tags.includes(tag) && (!typed || tag.startsWith(typed)))
    // An exact match beats a more used tag that only starts the same way.
    .sort((a, b) => Number(b.tag === typed) - Number(a.tag === typed))
    .slice(0, 7);
  const isNew = typed && !node.tags.includes(typed) && !app.tree.tags.some(({ tag }) => tag === typed);
  const items: Suggestion[] = [...existing, ...(isNew ? [{ tag: typed, count: null }] : [])];

  const add = (tag: string) => {
    addTag(app.doc, node.id, tag);
    setDraft("");
  };

  return (
    <span className="tag-input-wrap">
      <input
        className="tag-input"
        aria-label="New tag"
        placeholder="tag name"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            cancelled.current = true;
            return onDone();
          }
          // A comma finishes one tag and starts the next, as in most tag boxes.
          if (event.key === ",") {
            event.preventDefault();
            if (typed) add(typed);
            return;
          }
          if (event.key === "Enter" && !typed) {
            event.preventDefault();
            return onDone();
          }
          // Nothing to pick means the page already has this tag.
          if (event.key === "Enter" && !items.length) {
            event.preventDefault();
            return setDraft("");
          }
          if (typed && list.current?.onKeyDown(event.nativeEvent)) event.preventDefault();
        }}
        onBlur={() => {
          if (typed && !cancelled.current) addTag(app.doc, node.id, typed);
          onDone();
        }}
      />
      {items.length > 0 && (
        <SuggestionList
          ref={list}
          items={items}
          command={(item) => add(item.tag)}
          label="Tags"
          className="tag-suggest"
          empty=""
          itemKey={(item) => item.tag}
          renderItem={(item) => (
            <>
              <span className="suggest-title">#{item.tag}</span>
              <span className="suggest-detail">{item.count === null ? "new tag" : item.count}</span>
            </>
          )}
        />
      )}
    </span>
  );
}
