import type { DocNode } from "@/features/export/serialize";

// Every community call to Supabase, in one place. The tables and their rules
// are in supabase/migrations/20261023000000_community.sql: anyone may read,
// and only the signed-in owner may write their own rows.

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}

export interface PostPart {
  title?: string;
  level?: number;
  body: DocNode;
}

export interface Post {
  id: string;
  author: string;
  source_id: string;
  kind: "note" | "book";
  title: string;
  summary: string;
  tags: string[];
  parts: PostPart[];
  words: number;
  published_at: string;
  updated_at: string;
  profile?: Profile;
}

/** What lists show: everything but the parts, which only a reader needs. */
const LIST = "id, author, source_id, kind, title, summary, tags, words, published_at, updated_at, profile:profiles(*)";
const PAGE = 30;

const client = async () => (await import("@/features/account/client")).supabase;

/** Plain words for messages from the database, which speak Postgres. */
function fail(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new Error("That username is taken. Try another.");
  // A check failed. Postgres names the constraint in the message, like "profiles_username_check".
  if (error.code === "23514") {
    const field = /"(\w+?)_(\w+?)_check"/.exec(error.message)?.[2];
    if (field === "username") throw new Error("Usernames are 3 to 24 small letters, digits or _.");
    if (field === "avatar_url") throw new Error("The picture must be a link that starts with https://.");
    if (field === "tags") throw new Error("A post can have up to 10 tags.");
    if (field === "parts") throw new Error("This is too big to post.");
    throw new Error(field ? `The ${field.replace(/_/g, " ")} is too long or not allowed.` : "Something in it is too long or not allowed.");
  }
  if (error.code === "23503") throw new Error("Pick a username first.");
  if (error.code === "42P01" || error.code === "PGRST205") throw new Error("The community is not set up on the server yet.");
  throw new Error(error.message);
}

/** The signed-in person's id, from the saved session, without asking the server. */
export async function myId(): Promise<string | null> {
  const { data } = await (await client()).auth.getSession();
  return data.session?.user.id ?? null;
}

/** Name and picture from the Google account, to start a profile with. */
export async function accountNames(): Promise<{ name: string; avatar: string }> {
  const { data } = await (await client()).auth.getSession();
  const meta = data.session?.user.user_metadata ?? {};
  return { name: String(meta.full_name ?? ""), avatar: String(meta.avatar_url ?? "") };
}

export async function myProfile(): Promise<Profile | null> {
  const id = await myId();
  if (!id) return null;
  const { data, error } = await (await client()).from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) fail(error);
  return data as Profile | null;
}

export async function saveProfile(fields: Pick<Profile, "username" | "display_name" | "bio" | "avatar_url">): Promise<Profile> {
  const id = await myId();
  if (!id) throw new Error("Sign in first.");
  const { data, error } = await (await client())
    .from("profiles")
    .upsert({ id, ...fields, username: fields.username.trim().toLowerCase() })
    .select("*")
    .single();
  if (error) fail(error);
  return data as Profile;
}

/** Newest posts first, from everyone or only from people followed. */
export async function feed(following: boolean): Promise<Post[]> {
  const db = await client();
  let query = db.from("posts").select(LIST).order("published_at", { ascending: false }).limit(PAGE);
  if (following) {
    const id = await myId();
    if (!id) return [];
    const { data: follows, error } = await db.from("follows").select("followee").eq("follower", id);
    if (error) fail(error);
    const ids = (follows ?? []).map((row) => row.followee as string);
    if (!ids.length) return [];
    query = query.in("author", ids);
  }
  const { data, error } = await query;
  if (error) fail(error);
  return (data ?? []) as unknown as Post[];
}

/** Posts matching words in their title, summary, tags or text, best first. */
export async function searchPosts(words: string): Promise<Post[]> {
  const { data, error } = await (await client()).from("posts").select(LIST).textSearch("search", words, { type: "websearch", config: "simple" }).limit(PAGE);
  if (error) fail(error);
  return (data ?? []) as unknown as Post[];
}

/** People whose username or name has the words in it. */
export async function searchPeople(words: string): Promise<Profile[]> {
  // Quoted for PostgREST, so dots and commas in a name are fine; quotes, backslashes and wildcards are left out.
  const safe = words.replace(/["\\*%]/g, " ").trim();
  if (!safe) return [];
  const { data, error } = await (await client())
    .from("profiles")
    .select("*")
    .or(`username.ilike."*${safe}*",display_name.ilike."*${safe}*"`)
    .limit(20);
  if (error) fail(error);
  return (data ?? []) as Profile[];
}

export interface ProfilePage {
  profile: Profile;
  posts: Post[];
  followers: number;
  following: number;
  /** Whether the signed-in person follows them; null when signed out or it is them. */
  followed: boolean | null;
}

export async function profilePage(username: string): Promise<ProfilePage | null> {
  const db = await client();
  const { data: profile, error } = await db.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  if (error) fail(error);
  if (!profile) return null;
  const id = (profile as Profile).id;
  const me = await myId();
  const [posts, followers, following, mine] = await Promise.all([
    db.from("posts").select(LIST).eq("author", id).order("published_at", { ascending: false }).limit(100),
    db.from("follows").select("*", { count: "exact", head: true }).eq("followee", id),
    db.from("follows").select("*", { count: "exact", head: true }).eq("follower", id),
    me && me !== id ? db.from("follows").select("followee").eq("follower", me).eq("followee", id) : Promise.resolve(null),
  ]);
  for (const result of [posts, followers, following, mine]) if (result?.error) fail(result.error);
  return {
    profile: profile as Profile,
    posts: (posts.data ?? []) as unknown as Post[],
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    followed: mine ? (mine.data ?? []).length > 0 : null,
  };
}

export async function follow(id: string, on: boolean) {
  const me = await myId();
  if (!me) throw new Error("Sign in to follow people.");
  const db = await client();
  const { error } = on ? await db.from("follows").insert({ follower: me, followee: id }) : await db.from("follows").delete().eq("follower", me).eq("followee", id);
  if (error && error.code !== "23505") fail(error);
}

/** One post with its text, for reading. */
export async function readPost(id: string): Promise<Post | null> {
  const { data, error } = await (await client()).from("posts").select("*, profile:profiles(*)").eq("id", id).maybeSingle();
  if (error) fail(error);
  return data as unknown as Post | null;
}

/** This person's post of a page, if they posted it. */
export async function myPostOf(sourceId: string): Promise<Post | null> {
  const me = await myId();
  if (!me) return null;
  const { data, error } = await (await client()).from("posts").select(LIST).eq("author", me).eq("source_id", sourceId).maybeSingle();
  if (error) fail(error);
  return data as unknown as Post | null;
}

export type NewPost = Pick<Post, "source_id" | "kind" | "title" | "summary" | "tags" | "parts" | "words"> & { text_content: string };

/** Posts a snapshot, or replaces the one posted from the same page before. */
export async function publish(post: NewPost): Promise<Post> {
  const me = await myId();
  if (!me) throw new Error("Sign in to post.");
  const now = new Date().toISOString();
  const { data, error } = await (await client())
    .from("posts")
    .upsert({ ...post, author: me, updated_at: now }, { onConflict: "author,source_id" })
    .select(LIST)
    .single();
  if (error) fail(error);
  return data as unknown as Post;
}

export async function unpublish(sourceId: string) {
  const me = await myId();
  if (!me) return;
  const { error } = await (await client()).from("posts").delete().eq("author", me).eq("source_id", sourceId);
  if (error) fail(error);
}

/** The newest people to join, for the "Writers" list beside the feed. */
export async function newestPeople(limit = 6): Promise<Profile[]> {
  const { data, error } = await (await client()).from("profiles").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) fail(error);
  return (data ?? []) as Profile[];
}
