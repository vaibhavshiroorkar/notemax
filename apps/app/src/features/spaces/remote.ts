import type { SyncRemote } from "@notemax/core";
import { spaceChanges, spaceMine, spaceRead, spaceRemove, spaceWrite } from "./api";

// A shared workspace as the sync engine sees it: one sealed file per page and
// device, like Drive, but kept in Supabase behind the workspace's access rules.

/** Big files, like long videos, stay on the devices: the server takes a few megabytes per file. */
export const MAX_FILE_BYTES = 6 * 1024 * 1024;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export interface SpaceRemoteOptions {
  space: string;
  token: string | null;
  device: string;
  /** Whether this person may write now. A viewer's copy only reads, and sends nothing. */
  canWrite(): boolean;
  /** Called after each file sent, so the others can be told to look. */
  onWrite?(): void;
  /** A file too big to share was left out. */
  onTooBig?(docId: string): void;
}

export function spaceRemote({ space, token, device, canWrite, onWrite, onTooBig }: SpaceRemoteOptions): SyncRemote {
  return {
    async changes(cursor) {
      const result = await spaceChanges(space, token, cursor === null ? null : Number(cursor));
      return {
        // The device first: a doc id may hold any character, a device id holds no newline.
        entries: result.entries.map((entry) => ({ docId: entry.docId, device: entry.device, ref: `${entry.device}\n${entry.docId}` })),
        cursor: String(result.cursor),
      };
    },
    async read(ref) {
      const at = ref.indexOf("\n");
      const data = await spaceRead(space, token, ref.slice(at + 1), ref.slice(0, at));
      // Removed after the list was read. The next look starts from the same place and no longer lists it.
      if (data === null) throw new Error("A shared file went away while it was being read.");
      return fromBase64(data);
    },
    async write(docId, data) {
      if (!canWrite()) return;
      if (data.length > MAX_FILE_BYTES) return onTooBig?.(docId);
      await spaceWrite(space, token, docId, device, toBase64(data));
      onWrite?.();
    },
    async remove(docId) {
      if (!canWrite()) return;
      await spaceRemove(space, token, docId, device);
      onWrite?.();
    },
    listMine: () => spaceMine(space, token, device),
  };
}
