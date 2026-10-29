import type { Profile } from "./api";

// Private notes from readers to an author, against the table in
// supabase/migrations/20261029000000_reader_notes.sql. Only the reader who
// wrote one and the post's author can see it; the server decides that.

export interface ReaderNote {
  id: string;
  post_id: string;
  author: string;
  part: number;
  part_id: string;
  quote: string;
  body: string;
  created_at: string;
  read_at: string | null;
  profile?: Profile;
}

/** What the views say before the table exists on the server. */
export const NOTES_NOT_SET_UP = "Private notes are not set up on the server yet.";

/** As the server checks. */
export const MAX_QUOTE = 1000;
export const MAX_NOTE = 4000;

const client = async () => (await import("@/features/account/client")).supabase;

async function me(): Promise<string> {
  const { data } = await (await client()).auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sign in first.");
  return id;
}

function fail(error: { code?: string; message: string; hint?: string }): never {
  if (error.hint === "rate_limit") throw new Error("That is a lot at once. Wait a minute, then try again.");
  if (error.code === "42501") throw new Error("This author is not taking notes from you.");
  if (error.code === "23503") throw new Error("Pick a username first, in your profile.");
  if (error.code === "23514") throw new Error("That is too long, or empty.");
  if (error.code === "42P01" || error.code === "PGRST205") throw new Error(NOTES_NOT_SET_UP);
  throw new Error(error.message);
}

export interface NewNote {
  postId: string;
  part: number;
  partId: string;
  quote: string;
  body: string;
}

export async function sendNote({ postId, part, partId, quote, body }: NewNote): Promise<ReaderNote> {
  const text = body.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > MAX_NOTE) throw new Error(`Keep it under ${MAX_NOTE} characters.`);
  const { data, error } = await (await client())
    .from("reader_notes")
    .insert({ post_id: postId, author: await me(), part, part_id: partId.slice(0, 100), quote: quote.trim().slice(0, MAX_QUOTE), body: text })
    .select("*, profile:profiles(*)")
    .single();
  if (error) fail(error);
  return data as unknown as ReaderNote;
}

/** The notes on a post: every reader's for its author, only your own for a reader. */
export async function notesOn(postId: string): Promise<ReaderNote[]> {
  const { data, error } = await (await client()).from("reader_notes").select("*, profile:profiles(*)").eq("post_id", postId).order("created_at", { ascending: false }).limit(300);
  if (error) fail(error);
  return (data ?? []) as unknown as ReaderNote[];
}

export async function markNotesRead(ids: string[]) {
  if (!ids.length) return;
  const { error } = await (await client()).from("reader_notes").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  if (error) fail(error);
}

export async function removeNote(id: string) {
  const { error } = await (await client()).from("reader_notes").delete().eq("id", id);
  if (error) fail(error);
}
