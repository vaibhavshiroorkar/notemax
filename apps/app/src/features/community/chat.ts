import type { Profile } from "./api";

// Talking in the community, against the tables in
// supabase/migrations/20261025000000_community_chat.sql: direct messages
// between two people, comments under posts, and topic rooms. The server
// decides who may read and write; this only asks.

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  other: Profile;
  last: Message;
  unread: number;
}

export interface Comment {
  id: string;
  post_id: string;
  author: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  profile?: Profile;
}

export interface Room {
  id: string;
  slug: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface RoomMessage {
  id: string;
  room_id: string;
  author: string;
  body: string;
  created_at: string;
  profile?: Profile;
}

/** What the views say before the chat tables exist on the server. */
export const NOT_SET_UP = "Chat is not set up on the server yet.";

/** The most a message, comment or room message may hold, as the server checks. */
export const MAX_BODY = 4000;

const client = async () => (await import("@/features/account/client")).supabase;

async function me(): Promise<string> {
  const { data } = await (await client()).auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sign in first.");
  return id;
}

/** Plain words for what the server says no to. */
function fail(error: { code?: string; message: string; hint?: string }): never {
  if (error.hint === "rate_limit") throw new Error("That is a lot of messages at once. Wait a minute, then try again.");
  if (error.hint === "room_limit") throw new Error("You made three rooms today. Try again tomorrow.");
  if (error.code === "42501") throw new Error("This person is not taking messages from you.");
  if (error.code === "23503") throw new Error("Pick a username first, in your profile.");
  if (error.code === "23505") throw new Error("That room name is taken. Try another.");
  if (error.code === "23514") throw new Error("That is too long, or empty.");
  if (error.code === "42P01" || error.code === "PGRST205") throw new Error(NOT_SET_UP);
  throw new Error(error.message);
}

const clean = (body: string) => {
  const text = body.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > MAX_BODY) throw new Error(`Keep it under ${MAX_BODY.toLocaleString()} characters.`);
  return text;
};

async function profilesOf(ids: string[]): Promise<Map<string, Profile>> {
  if (!ids.length) return new Map();
  const { data, error } = await (await client()).from("profiles").select("*").in("id", [...new Set(ids)]);
  if (error) fail(error);
  return new Map(((data ?? []) as Profile[]).map((profile) => [profile.id, profile]));
}

/** Everyone you have written with, the latest talk first, with how many of theirs you have not read. */
export async function conversations(): Promise<Conversation[]> {
  const id = await me();
  const { data, error } = await (await client()).from("messages").select("*").or(`sender.eq.${id},recipient.eq.${id}`).order("created_at", { ascending: false }).limit(500);
  if (error) fail(error);
  const byOther = new Map<string, { last: Message; unread: number }>();
  for (const message of (data ?? []) as Message[]) {
    const other = message.sender === id ? message.recipient : message.sender;
    const entry = byOther.get(other) ?? { last: message, unread: 0 };
    if (message.recipient === id && !message.read_at) entry.unread++;
    byOther.set(other, entry);
  }
  const profiles = await profilesOf([...byOther.keys()]);
  return [...byOther].flatMap(([other, entry]) => (profiles.has(other) ? [{ other: profiles.get(other)!, ...entry }] : []));
}

/** The talk with one person, oldest first. */
export async function thread(other: string): Promise<Message[]> {
  const id = await me();
  const { data, error } = await (await client())
    .from("messages")
    .select("*")
    .or(`and(sender.eq.${id},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${id})`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) fail(error);
  return ((data ?? []) as Message[]).reverse();
}

export async function sendMessage(to: string, body: string): Promise<Message> {
  const { data, error } = await (await client())
    .from("messages")
    .insert({ sender: await me(), recipient: to, body: clean(body) })
    .select("*")
    .single();
  if (error) fail(error);
  return data as Message;
}

/** Marks what someone sent you as read. */
export async function markRead(from: string) {
  const id = await me();
  const { error } = await (await client()).from("messages").update({ read_at: new Date().toISOString() }).eq("recipient", id).eq("sender", from).is("read_at", null);
  if (error) fail(error);
}

/** How many messages wait unread, for the badge on Messages. */
export async function unreadCount(): Promise<number> {
  const id = await me();
  const { count, error } = await (await client()).from("messages").select("*", { count: "exact", head: true }).eq("recipient", id).is("read_at", null);
  if (error) fail(error);
  return count ?? 0;
}

/** Whether you blocked someone. Blocking stops their messages and their comments under your posts. */
export async function isBlocked(other: string): Promise<boolean> {
  const { data, error } = await (await client()).from("blocks").select("blocked").eq("blocker", await me()).eq("blocked", other);
  if (error) fail(error);
  return (data ?? []).length > 0;
}

export async function setBlocked(other: string, on: boolean) {
  const id = await me();
  const db = await client();
  const { error } = on ? await db.from("blocks").insert({ blocker: id, blocked: other }) : await db.from("blocks").delete().eq("blocker", id).eq("blocked", other);
  if (error && error.code !== "23505") fail(error);
}

/** A post's comments, oldest first, with who wrote them. */
export async function commentsOn(postId: string): Promise<Comment[]> {
  const { data, error } = await (await client()).from("comments").select("*, profile:profiles(*)").eq("post_id", postId).order("created_at", { ascending: true }).limit(500);
  if (error) fail(error);
  return (data ?? []) as unknown as Comment[];
}

export async function addComment(postId: string, body: string, parentId: string | null = null): Promise<Comment> {
  const { data, error } = await (await client())
    .from("comments")
    .insert({ post_id: postId, author: await me(), parent_id: parentId, body: clean(body) })
    .select("*, profile:profiles(*)")
    .single();
  if (error) fail(error);
  return data as unknown as Comment;
}

export async function removeComment(id: string) {
  const { error } = await (await client()).from("comments").delete().eq("id", id);
  if (error) fail(error);
}

export async function listRooms(): Promise<Room[]> {
  const { data, error } = await (await client()).from("rooms").select("*").order("created_at", { ascending: true }).limit(200);
  if (error) fail(error);
  return (data ?? []) as Room[];
}

/** A room's address from its name: small letters, digits and dashes. */
export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

export async function createRoom(name: string, description: string): Promise<Room> {
  const slug = slugOf(name);
  if (slug.length < 2) throw new Error("Give the room a name of two letters or more.");
  const { data, error } = await (await client())
    .from("rooms")
    .insert({ slug, name: name.trim().slice(0, 60), description: description.trim().slice(0, 300), created_by: await me() })
    .select("*")
    .single();
  if (error) fail(error);
  return data as Room;
}

export async function roomBySlug(slug: string): Promise<Room | null> {
  const { data, error } = await (await client()).from("rooms").select("*").eq("slug", slug).maybeSingle();
  if (error) fail(error);
  return data as Room | null;
}

/** The last hundred messages in a room, oldest first. */
export async function roomMessages(roomId: string): Promise<RoomMessage[]> {
  const { data, error } = await (await client()).from("room_messages").select("*, profile:profiles(*)").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100);
  if (error) fail(error);
  return ((data ?? []) as unknown as RoomMessage[]).reverse();
}

export async function sendToRoom(roomId: string, body: string): Promise<RoomMessage> {
  const { data, error } = await (await client())
    .from("room_messages")
    .insert({ room_id: roomId, author: await me(), body: clean(body) })
    .select("*, profile:profiles(*)")
    .single();
  if (error) fail(error);
  return data as unknown as RoomMessage;
}

export async function removeRoomMessage(id: string) {
  const { error } = await (await client()).from("room_messages").delete().eq("id", id);
  if (error) fail(error);
}

/**
 * Calls `onNew` when a row arrives in a table, for the open chat, thread or
 * room, through Supabase Realtime. The server sends only rows this person may
 * read. Returns a way to stop. A live connection that fails changes nothing:
 * the views also look again now and then.
 */
export function onNewRows(table: "messages" | "comments" | "room_messages", filter: string, onNew: () => void): () => void {
  let stop = () => {};
  let live = true;
  void client()
    .then((db) => {
      if (!live) return;
      const channel = db
        .channel(`notemax-${table}-${filter}-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => onNew())
        .subscribe();
      stop = () => void db.removeChannel(channel);
    })
    .catch(() => {});
  return () => {
    live = false;
    stop();
  };
}
