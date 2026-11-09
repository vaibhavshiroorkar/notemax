// The server side of shared workspaces: functions in Supabase that check the
// caller's role before every read and write (supabase/migrations/*_shared_workspaces.sql).

export type Role = "owner" | "admin" | "editor" | "viewer";
export type LinkAccess = "off" | "view" | "edit";

export const RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 };
export const atLeast = (role: Role | null | undefined, least: Role) => !!role && RANK[role] >= RANK[least];

export interface SpaceInfo {
  id: string;
  name: string;
  /** The workspace's AES key, base64. */
  key: string;
  role: Role;
  /** The owner's email. */
  owner: string | null;
  linkAccess: LinkAccess;
  /** Admins and the owner only. */
  linkToken: string | null;
}

export interface Person {
  email: string;
  role: Exclude<Role, "owner">;
  addedAt: string;
}

export interface SharedWithMe {
  id: string;
  name: string;
  role: Exclude<Role, "owner">;
  owner: string | null;
  addedAt: string;
}

function friendly(error: { message: string; code?: string }): string {
  // The migration is not on the server yet.
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) return "Shared workspaces are not set up on the server yet.";
  if (error.code === "42501") return error.message === "not allowed" ? "You do not have access to do that." : error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  if (error.code === "54000" || error.code === "22023") return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  return error.message;
}

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { supabase } = await import("@/features/account/client");
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(friendly(error));
  return data as T;
}

export const createSpace = (name: string, key: string) => rpc<{ id: string; token: string }>("space_create", { p_name: name, p_key: key });
export const openSpace = (space: string, token: string | null) => rpc<SpaceInfo | null>("space_open", { p_space: space, p_token: token });
export const spaceChanges = (space: string, token: string | null, after: number | null) =>
  rpc<{ cursor: number; entries: { docId: string; device: string }[] }>("space_changes", { p_space: space, p_token: token, p_after: after });
export const spaceRead = (space: string, token: string | null, docId: string, device: string) => rpc<string | null>("space_read", { p_space: space, p_token: token, p_doc: docId, p_device: device });
export const spaceWrite = (space: string, token: string | null, docId: string, device: string, data: string) =>
  rpc<void>("space_write", { p_space: space, p_token: token, p_doc: docId, p_device: device, p_data: data });
export const spaceRemove = (space: string, token: string | null, docId: string, device: string) => rpc<void>("space_remove", { p_space: space, p_token: token, p_doc: docId, p_device: device });
export const spaceMine = (space: string, token: string | null, device: string) => rpc<string[]>("space_mine", { p_space: space, p_token: token, p_device: device });
export const spacePeople = (space: string, token: string | null) => rpc<Person[]>("space_people", { p_space: space, p_token: token });
export const invite = (space: string, token: string | null, email: string, role: Person["role"]) => rpc<void>("space_invite", { p_space: space, p_token: token, p_email: email, p_role: role });
export const uninvite = (space: string, token: string | null, email: string) => rpc<void>("space_uninvite", { p_space: space, p_token: token, p_email: email });
export const setLinkAccess = (space: string, token: string | null, access: LinkAccess, newToken = false) =>
  rpc<string>("space_set_link", { p_space: space, p_token: token, p_access: access, p_new_token: newToken });
export const renameSpace = (space: string, token: string | null, name: string) => rpc<void>("space_rename", { p_space: space, p_token: token, p_name: name });
export const deleteSpace = (space: string) => rpc<void>("space_delete", { p_space: space });
export const sharedWithMe = () => rpc<SharedWithMe[]>("spaces_for_me");
