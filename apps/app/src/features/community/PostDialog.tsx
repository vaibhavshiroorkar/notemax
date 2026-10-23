import { useEffect, useState } from "react";
import { getPref, setPref } from "@/platform/prefs";
import type { AppContext } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { myId, myPostOf, myProfile, publish, unpublish, type Post, type Profile } from "./api";
import { ProfileForm } from "./ProfileForm";
import { snapshotOf } from "./snapshot";

const RIGHTS = "communityRights";

/**
 * Posts a note or book to the community as it is now. Readers see that
 * snapshot; later edits stay private until it is posted again (Update).
 */
export function PostDialog({ app, options, onClose }: { app: AppContext; options: Record<string, unknown>; onClose(): void }) {
  const node = app.tree.byId.get(String(options.pageId));
  const [state, setState] = useState<{ me: string | null; profile: Profile | null; post: Post | null } | null>(null);
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState((node?.tags ?? []).join(", "));
  const [rights, setRights] = useState(getPref(RIGHTS) === "1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!node) return;
    void Promise.all([myId(), myProfile(), myPostOf(node.id)])
      .then(([me, profile, post]) => {
        setState({ me, profile, post });
        if (post) {
          setSummary(post.summary);
          setTags(post.tags.join(", "));
        }
      })
      .catch((failure: unknown) => setError(failure instanceof Error ? failure.message : String(failure)));
  }, [node]);

  if (!node) return null;
  const openCommunity = (username: string) => {
    onClose();
    app.openView("community", { username });
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (!state) body = error ? <p className="community-error">{error}</p> : <p className="community-meta">Loading...</p>;
  else if (!state.me)
    body = (
      <>
        <p>Sign in to post to the community. Reading it needs no account.</p>
        <button
          className="button button-primary"
          onClick={() => {
            onClose();
            app.openOverlay("account");
          }}
        >
          Sign in
        </button>
      </>
    );
  else if (!state.profile) body = <ProfileForm intro="Pick a username first. It shows on your posts." onSaved={(profile) => setState({ ...state, profile })} />;
  else
    body = (
      <form
        className="community-form"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const words = tags
              .split(/[,\s]+/)
              .map((tag) => tag.replace(/^#/, "").toLowerCase())
              .filter(Boolean)
              .slice(0, 10);
            const post = await publish(await snapshotOf(node, app, summary, words));
            setPref(RIGHTS, "1");
            setState({ ...state, post });
            app.notify(state.post ? "Updated your post" : "Posted to the community", { label: "See it", run: () => app.openView("community", { username: state.profile!.username }) });
          });
        }}
      >
        <p className="community-meta">
          {state.post
            ? `Posted ${new Date(state.post.published_at).toLocaleDateString()}. Readers see that version until you update it.`
            : "Everyone can read it, with your name on it. Readers see it as it is now; your later edits stay private until you update the post."}
        </p>
        <label>
          A line about it
          <textarea value={summary} maxLength={500} rows={2} placeholder="What is it about?" onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label>
          Tags
          <input value={tags} placeholder="fiction, rain" onChange={(event) => setTags(event.target.value)} />
        </label>
        {getPref(RIGHTS) !== "1" && (
          <label className="settings-row settings-check">
            <span>I wrote this, or I have the right to post it.</span>
            <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
          </label>
        )}
        <p className="community-meta">Pictures and videos kept on this device and boards are not posted yet. Links to your other pages show as their titles.</p>
        {error && <p className="community-error">{error}</p>}
        <div className="dialog-actions">
          {state.post && (
            <button
              type="button"
              className="button button-danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await unpublish(node.id);
                  setState({ ...state, post: null });
                  app.notify("Took the post down");
                })
              }
            >
              Take down
            </button>
          )}
          {state.post && (
            <button type="button" className="button" onClick={() => openCommunity(state.profile!.username)}>
              See it
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={busy || !rights}>
            {busy ? "Posting..." : state.post ? "Update post" : "Post"}
          </button>
        </div>
      </form>
    );

  return (
    <Dialog label="Post to the community" onClose={onClose} className="community-post-dialog">
      <header className="settings-header">
        <h2 className="dialog-title">Post "{node.title || "Untitled"}"</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <Icon name="close" />
        </button>
      </header>
      {body}
    </Dialog>
  );
}
