import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toHtml } from "@/features/export/serialize";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { safeHtml } from "@/ui/safeHtml";
import { feed, follow, myId, myProfile, newestPeople, profilePage, readPost, searchPeople, searchPosts, type Post, type Profile, type ProfilePage } from "./api";
import { ProfileForm } from "./ProfileForm";

/** Where the community screen is: a place and what it needs to show it. */
export type Place = { view: "feed"; following: boolean } | { view: "search"; words: string } | { view: "profile"; username: string } | { view: "post"; id: string } | { view: "me" };

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
/** Minutes to read, at 230 words a minute, like the status bar. */
const readTime = (words: number) => `${Math.max(1, Math.round(words / 230))} min read`;
const nameOf = (profile?: Profile) => profile?.display_name || profile?.username || "Someone";
// Readers have none of the author's pages or pictures; the snapshot already holds what shows.
const NOTHING = { title: () => null, image: () => null };

/** A loader's result, with its error in words, and a way to load again. */
function useLoad<T>(load: () => Promise<T>, deps: unknown[]): { data?: T; error?: string; loading: boolean; reload(): void } {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    setState((old) => ({ data: old.data, loading: true }));
    load().then(
      (data) => live && setState({ data, loading: false }),
      (error: unknown) => live && setState({ error: error instanceof Error ? error.message : String(error), loading: false }),
    );
    return () => {
      live = false;
    };
    // The caller names what the load depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, round]);
  return { ...state, reload: () => setRound((n) => n + 1) };
}

function Avatar({ profile, size = 28 }: { profile?: Profile; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (profile?.avatar_url && !broken) return <img className="community-avatar" src={profile.avatar_url} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
  return (
    <span className="community-avatar" data-initial style={{ width: size, height: size }} aria-hidden="true">
      {nameOf(profile).slice(0, 1).toUpperCase()}
    </span>
  );
}

function Byline({ profile, go, children }: { profile?: Profile; go(place: Place): void; children?: ReactNode }) {
  return (
    <span className="community-byline">
      <button className="community-person" onClick={() => profile && go({ view: "profile", username: profile.username })}>
        <Avatar profile={profile} size={22} />
        <span>{nameOf(profile)}</span>
        {profile && <span className="community-handle">@{profile.username}</span>}
      </button>
      {children}
    </span>
  );
}

function PostList({ posts, go, empty, featureFirst = false }: { posts: Post[]; go(place: Place): void; empty: ReactNode; featureFirst?: boolean }) {
  if (!posts.length) return <>{empty}</>;
  return (
    <ul className="community-posts">
      {posts.map((post, i) => (
        <li key={post.id} className="community-card" data-featured={(featureFirst && i === 0) || undefined}>
          <Byline profile={post.profile} go={go}>
            <span className="community-meta">{when(post.published_at)}</span>
          </Byline>
          <button className="community-card-open" onClick={() => go({ view: "post", id: post.id })}>
            {featureFirst && i === 0 && <span className="community-kicker">Newest</span>}
            <strong className="community-card-title">{post.title}</strong>
            {post.summary && <span className="community-summary">{post.summary}</span>}
            <span className="community-meta">
              {post.kind === "book" && (
                <span className="community-badge">
                  <Icon name="book" />
                  Book
                </span>
              )}
              {readTime(post.words)}
              {post.tags.map((tag) => (
                <span key={tag} className="community-tag">
                  #{tag}
                </span>
              ))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Status({ error, loading, children }: { error?: string; loading: boolean; children: ReactNode }) {
  if (error) return <p className="community-error">{error}</p>;
  if (loading) return <p className="community-empty" aria-busy="true">Loading...</p>;
  return <>{children}</>;
}

/** Where you are in the community, and the way to start: sign in, pick a username, or your profile. */
function YouCard({ app, me, mine, go }: { app: AppContext; me: string | null; mine: Profile | null; go(place: Place): void }) {
  if (!me)
    return (
      <section className="community-box">
        <h2>Join in</h2>
        <p>Reading needs no account. Sign in to post your own notes and books and to follow writers.</p>
        <button className="button button-primary" onClick={() => app.openOverlay("account")}>
          Sign in to post
        </button>
      </section>
    );
  if (!mine)
    return (
      <section className="community-box">
        <h2>Pick a username</h2>
        <p>It shows on your posts and is how people find you.</p>
        <button className="button button-primary" onClick={() => go({ view: "me" })}>
          Pick a username
        </button>
      </section>
    );
  return (
    <section className="community-box community-you">
      <button className="community-person" onClick={() => go({ view: "profile", username: mine.username })}>
        <Avatar profile={mine} size={40} />
        <span className="community-you-text">
          <strong>{nameOf(mine)}</strong>
          <span className="community-handle">@{mine.username}</span>
        </span>
      </button>
      <p className="community-meta">To post, open a note or book's menu (... or right click) and pick Post to community.</p>
    </section>
  );
}

/** The most used tags in what is shown, most used first. */
function topTags(posts: Post[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([tag]) => tag);
}

function FeedView({ following, go, app, me, mine }: { following: boolean; go(place: Place): void; app: AppContext; me: string | null; mine: Profile | null }) {
  const { data, error, loading } = useLoad(() => feed(following), [following]);
  const writers = useLoad(() => newestPeople(), []);
  const posts = data ?? [];
  const tags = topTags(posts);
  return (
    <div className="community-home">
      <section className="community-hero">
        <h1>Community</h1>
        <p>Notes and books people chose to share. Read, follow the writers you like, and post your own.</p>
      </section>
      <div className="community-columns">
        <div className="community-main">
          <div className="community-tabs" role="tablist" aria-label="Feed">
            <button role="tab" aria-selected={!following} onClick={() => go({ view: "feed", following: false })}>
              Latest
            </button>
            <button role="tab" aria-selected={following} disabled={!me} title={me ? undefined : "Sign in to follow people"} onClick={() => go({ view: "feed", following: true })}>
              Following
            </button>
          </div>
          <Status error={error} loading={loading && !data}>
            <PostList
              posts={posts}
              go={go}
              featureFirst={!following}
              empty={
                following ? (
                  <p className="community-empty">Nobody you follow has posted yet. Writers to follow are on the side, or search for someone.</p>
                ) : (
                  <section className="community-first">
                    <Icon name="people" />
                    <h2>Nothing here yet</h2>
                    <p>Open a note or book, then its menu (... or right click), and pick Post to community to be the first.</p>
                  </section>
                )
              }
            />
          </Status>
        </div>
        <aside className="community-aside" aria-label="About the community">
          <YouCard app={app} me={me} mine={mine} go={go} />
          {tags.length > 0 && (
            <section className="community-box">
              <h2>Popular tags</h2>
              <div className="community-chips">
                {tags.map((tag) => (
                  <button key={tag} className="community-tag community-chip" onClick={() => go({ view: "search", words: tag })}>
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          )}
          {!!writers.data?.length && (
            <section className="community-box">
              <h2>Writers</h2>
              <ul className="community-people">
                {writers.data.map((person) => (
                  <li key={person.id}>
                    <button className="community-person" onClick={() => go({ view: "profile", username: person.username })}>
                      <Avatar profile={person} />
                      <span>{nameOf(person)}</span>
                      <span className="community-handle">@{person.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function SearchView({ words, go }: { words: string; go(place: Place): void }) {
  const posts = useLoad(() => searchPosts(words), [words]);
  const people = useLoad(() => searchPeople(words), [words]);
  return (
    <>
      <h2 className="community-heading">People</h2>
      <Status error={people.error} loading={people.loading && !people.data}>
        {people.data?.length ? (
          <ul className="community-people">
            {people.data.map((person) => (
              <li key={person.id}>
                <button className="community-person" onClick={() => go({ view: "profile", username: person.username })}>
                  <Avatar profile={person} />
                  <span>{nameOf(person)}</span>
                  <span className="community-handle">@{person.username}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="community-empty">Nobody by that name.</p>
        )}
      </Status>
      <h2 className="community-heading">Posts</h2>
      <Status error={posts.error} loading={posts.loading && !posts.data}>
        <PostList posts={posts.data ?? []} go={go} empty={<p className="community-empty">No posts match "{words}".</p>} />
      </Status>
    </>
  );
}

function ProfileView({ username, go, me }: { username: string; go(place: Place): void; me: string | null }) {
  const { data, error, loading, reload } = useLoad<ProfilePage | null>(() => profilePage(username), [username]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  if (error || (loading && !data)) return <Status error={error} loading>{null}</Status>;
  if (!data) return <p className="community-empty">Nobody goes by @{username}.</p>;
  const { profile, posts, followers, following, followed } = data;
  const toggle = async () => {
    setBusy(true);
    setProblem(undefined);
    try {
      await follow(profile.id, !followed);
      reload();
    } catch (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="community-profile">
        <Avatar profile={profile} size={64} />
        <div className="community-profile-text">
          <h2>{nameOf(profile)}</h2>
          <span className="community-handle">@{profile.username}</span>
          {profile.bio && <p>{profile.bio}</p>}
          <span className="community-meta">
            {plural(posts.length, "post")} - {plural(followers, "follower")} - {following.toLocaleString()} following
          </span>
        </div>
        {profile.id === me ? (
          <button className="button" onClick={() => go({ view: "me" })}>
            Edit profile
          </button>
        ) : (
          followed !== null && (
            <button className={followed ? "button" : "button button-primary"} disabled={busy} onClick={() => void toggle()}>
              {followed ? "Following" : "Follow"}
            </button>
          )
        )}
      </header>
      {problem && <p className="community-error">{problem}</p>}
      <PostList posts={posts} go={go} empty={<p className="community-empty">{profile.id === me ? "You have not posted yet." : "No posts yet."}</p>} />
    </>
  );
}

function PostView({ id, go }: { id: string; go(place: Place): void }) {
  const { data: post, error, loading } = useLoad(() => readPost(id), [id]);
  if (error || (loading && !post)) return <Status error={error} loading>{null}</Status>;
  if (!post) return <p className="community-empty">This post was taken down.</p>;
  return (
    <article className="community-post">
      <Byline profile={post.profile} go={go}>
        <span className="community-meta">
          {when(post.published_at)}
          {post.updated_at.slice(0, 10) !== post.published_at.slice(0, 10) && `, updated ${when(post.updated_at)}`}
        </span>
      </Byline>
      <h1>{post.title}</h1>
      {post.summary && <p className="community-summary">{post.summary}</p>}
      {post.tags.length > 0 && (
        <p className="community-meta">
          {post.tags.map((tag) => (
            <button key={tag} className="community-tag" onClick={() => go({ view: "search", words: tag })}>
              #{tag}
            </button>
          ))}
        </p>
      )}
      {post.parts.map((part, i) => {
        const level = Math.min(2 + (part.level ?? 0), 6);
        const Heading = `h${level}` as "h2";
        return (
          <section key={i} className="community-part">
            {part.title && <Heading>{part.title}</Heading>}
            <div className="community-body" dangerouslySetInnerHTML={{ __html: safeHtml(toHtml(part.body.content ?? [], NOTHING)) }} />
          </section>
        );
      })}
    </article>
  );
}

const placeFrom = (options: Record<string, unknown>): Place =>
  typeof options.username === "string" ? { view: "profile", username: options.username } : options.place === "me" ? { view: "me" } : { view: "feed", following: false };

/**
 * The community, as a page of its own: everyone's posts or the people
 * followed, search across posts and people, profiles, and posts to read.
 * Reading needs no account; posting and following do.
 */
export function CommunityPage({ app, options }: { app: AppContext; options: Record<string, unknown> }) {
  const [trail, setTrail] = useState<Place[]>(() => [placeFrom(options)]);
  // Opened again somewhere new, like a profile from a post, starts from there.
  const asked = JSON.stringify(options);
  useEffect(() => setTrail([placeFrom(JSON.parse(asked) as Record<string, unknown>)]), [asked]);
  const place = trail.at(-1)!;
  const go = useCallback((next: Place) => setTrail((old) => [...old, next]), []);
  const back = () => setTrail((old) => (old.length > 1 ? old.slice(0, -1) : old));
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [mine, setMine] = useState<Profile | null>(null);
  useEffect(() => {
    void myId().then(setMe, () => setMe(null));
    void myProfile().then(setMine, () => setMine(null));
  }, [place]);

  return (
    <div className="community-screen">
      <header className="community-top">
        <button className="icon-button" aria-label="Back" title="Back" disabled={trail.length < 2} onClick={back}>
          <Icon name="arrow-left" />
        </button>
        <button className="community-title" onClick={() => go({ view: "feed", following: false })}>
          <Icon name="people" />
          Community
        </button>
        <span className="community-top-space" />
        {searching ? (
          <form
            className="community-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              if (query.trim()) go({ view: "search", words: query.trim() });
            }}
          >
            <Icon name="search" />
            <input
              type="search"
              placeholder="Search posts and people"
              aria-label="Search the community"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Escape" && (setSearching(false), setQuery(""))}
              onBlur={() => !query.trim() && setSearching(false)}
            />
          </form>
        ) : (
          <button className="icon-button" aria-label="Search the community" title="Search" onClick={() => setSearching(true)}>
            <Icon name="search" />
          </button>
        )}
        {me ? (
          <button className="community-person" onClick={() => go(mine ? { view: "profile", username: mine.username } : { view: "me" })}>
            <Avatar profile={mine ?? undefined} />
            <span className="community-me">{mine ? "My profile" : "Pick a username"}</span>
          </button>
        ) : (
          <button className="button" onClick={() => app.openOverlay("account")}>
            Sign in to post
          </button>
        )}
      </header>
      <main className="community-page">
        {place.view === "feed" && <FeedView following={place.following} go={go} app={app} me={me} mine={mine} />}
        {place.view === "search" && <SearchView key={place.words} words={place.words} go={go} />}
        {place.view === "profile" && <ProfileView key={place.username} username={place.username} go={go} me={me} />}
        {place.view === "post" && <PostView key={place.id} id={place.id} go={go} />}
        {place.view === "me" && (
          <ProfileForm
            onSaved={(saved) => {
              setMine(saved);
              go({ view: "profile", username: saved.username });
            }}
          />
        )}
      </main>
    </div>
  );
}
