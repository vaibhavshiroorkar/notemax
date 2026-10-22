import { useMemo } from "react";
import type { AppContext } from "@/plugins/types";
import { pageMenu } from "@/ui/ContextMenu";
import { indexVersion, mentionsOf } from "./text-index";

/** Pages that name the open page without linking to it, with the words around each mention. */
export function MentionsPanel({ app }: { app: AppContext }) {
  const version = indexVersion.use();
  const id = app.activeId!;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const found = useMemo(() => mentionsOf(app.tree, id), [app.tree, id, version]);
  if (!found.length) return <p className="mentions-empty">No other page names this one without linking to it.</p>;
  return (
    <ul className="mentions">
      {found.map((match) => (
        <li key={match.id}>
          <button className="mention" onClick={() => app.open(match.id)} onContextMenu={pageMenu(app.tree.byId.get(match.id))}>
            <span className="mention-title">{app.tree.byId.get(match.id)?.title || "Untitled"}</span>
            <span className="mention-snippet">{match.snippet}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
