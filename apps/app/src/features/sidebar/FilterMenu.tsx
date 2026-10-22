import { useEffect, useRef, useState } from "react";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { Safe } from "@/ui/Safe";
import { sidebarView, type GroupBy, type SortBy } from "./state";

const SORTS: [SortBy, string][] = [
  ["manual", "Your order"],
  ["title", "Title"],
  ["created", "Newest first"],
  ["edited", "Last edited"],
];
const GROUPS: [GroupBy, string][] = [
  ["none", "No groups"],
  ["kind", "By kind"],
];

/** The funnel by +: how the sidebar sorts and groups, and what plugins let it filter by. */
export function FilterMenu({ app, filtered }: { app: AppContext; filtered: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const view = sidebarView.use();
  const reordered = view.sort !== "manual" || view.group !== "none";
  // The funnel shows a dot while the list is not the plain tree, so that is never a surprise.
  const changed = reordered || filtered;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="filter-wrap" ref={wrapper}>
      <button
        className="icon-button filter-button"
        aria-label="Sort and filter"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Sort and filter"
        data-active={changed || undefined}
        onClick={() => setOpen(!open)}
      >
        <Icon name="filter" />
      </button>
      {open && (
        <div className="menu filter-menu" role="dialog" aria-label="Sort and filter">
          <fieldset>
            <legend>Sort</legend>
            {SORTS.map(([sort, label]) => (
              <label key={sort} className="filter-choice">
                <input type="radio" name="sidebar-sort" checked={view.sort === sort} onChange={() => sidebarView.set({ ...view, sort })} />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Group</legend>
            {GROUPS.map(([group, label]) => (
              <label key={group} className="filter-choice">
                <input type="radio" name="sidebar-group" checked={view.group === group} onChange={() => sidebarView.set({ ...view, group })} />
                {label}
              </label>
            ))}
          </fieldset>
          {registry.sidebarFilterChoices().map(({ id, component: Choice }) => (
            <Safe key={id} name={id}>
              <Choice app={app} />
            </Safe>
          ))}
          {reordered && (
            <button className="link-button filter-reset" onClick={() => sidebarView.set({ sort: "manual", group: "none" })}>
              Back to your order
            </button>
          )}
        </div>
      )}
    </div>
  );
}
