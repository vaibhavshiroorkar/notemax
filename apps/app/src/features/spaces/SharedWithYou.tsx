import { useEffect, useState } from "react";
import { accountsEnabled } from "@/features/account/config";
import { accountView } from "@/features/account/session";
import { workspaceList } from "@/features/workspaces/list";
import type { AppContext } from "@/plugins/types";
import { messageOf } from "@/ui/format";
import { sharedWithMe, type SharedWithMe } from "./api";
import { joinSpace } from "./actions";
import "./spaces.css";
import { Loading } from "@/ui/Spinner";

const ROLE_WORDS = { admin: "Admin", editor: "Can edit", viewer: "Can view" } as const;

/** On Home: workspaces people invited you to, by the email you sign in with. */
export function SharedWithYou({ app }: { app: AppContext }) {
  const account = accountView.use();
  const joined = workspaceList.use();
  const [items, setItems] = useState<SharedWithMe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = account.state === "in";

  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    sharedWithMe().then(
      (found) => live && setItems(found),
      (err: unknown) => live && setError(messageOf(err)),
    );
    return () => {
      live = false;
    };
  }, [signedIn]);

  if (!accountsEnabled) return null;
  if (!signedIn) return <p className="home-empty">Sign in to see workspaces people shared with you.</p>;
  if (error) return <p className="home-empty">{error}</p>;
  if (!items) return <Loading className="home-empty">Looking...</Loading>;
  if (!items.length) return <p className="home-empty">Nobody has shared a workspace with you yet. When someone invites {account.email}, it shows here.</p>;
  return (
    <ul className="space-shared-list">
      {items.map((item) => {
        const here = joined.some((w) => w.shared?.space === item.id);
        return (
          <li key={item.id}>
            <span className="space-shared-name">
              <strong>{item.name || "Shared workspace"}</strong>
              <span className="share-people">
                {ROLE_WORDS[item.role]}
                {item.owner ? `, from ${item.owner}` : ""}
              </span>
            </span>
            <button
              className="button"
              onClick={() =>
                void joinSpace(item.id, null).then(
                  (result) => {
                    if (!result) return app.notify("This workspace is no longer shared with you.");
                    if (!here) app.notify(`Added ${result.name}. Its pages arrive in a moment.`);
                  },
                  (err: unknown) => app.notify(`Could not open it: ${messageOf(err)}`),
                )
              }
            >
              {here ? "Open" : "Add"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
