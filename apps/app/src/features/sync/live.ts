import { exportKey, seal, unseal } from "@notemax/core";
import { createStore, savedStore } from "@/platform/store";

// Live updates: while two devices are open, each edit also goes straight to
// the others through a Supabase Realtime channel, so a note changes on the
// phone a moment after typing on the laptop. Drive stays the record; this only
// makes it quicker, so anything missed here still arrives with the next sync.
// Edits are sealed with the same passphrase key as the Drive files, and the
// channel's name comes from that key, so only the person's own devices can
// find it or read it.

/** The setting. On by default; it only does anything while sync is on. */
export const liveOn = savedStore<boolean>("liveSync", true);

export type LiveState = "off" | "connecting" | "live" | "error";
export const liveState = createStore<LiveState>("off");

/** A page changed by another device, last first, so the open page can say so. */
export const remoteEdit = createStore<{ docId: string; at: number } | null>(null);
export const noteRemoteEdit = (docId: string) => remoteEdit.set({ docId, at: Date.now() });

// Realtime caps a message well below a megabyte. A bigger edit, like a pasted
// chapter, waits for Drive instead of failing here.
const MAX_BYTES = 96 * 1024;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function channelName(key: CryptoKey): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${await exportKey(key)}:live`));
  return `notemax-${[...new Uint8Array(digest)]
    .slice(0, 20)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

export interface LiveLink {
  send(docId: string, update: Uint8Array): void;
  stop(): void;
}

interface Edit {
  docId: string;
  device: string;
  data: string;
}

/** Joins this person's live channel. `onEdit` gets each edit another device sends. */
export async function startLive(key: CryptoKey, device: string, onEdit: (docId: string, update: Uint8Array) => void): Promise<LiveLink> {
  const { supabase } = await import("@/features/account/client");
  liveState.set("connecting");
  const channel = supabase.channel(await channelName(key), { config: { broadcast: { self: false } } });
  channel.on("broadcast", { event: "edit" }, ({ payload }: { payload: Edit }) => {
    if (payload.device === device) return;
    unseal(key, fromBase64(payload.data))
      .then((update) => onEdit(payload.docId, update))
      .catch(() => {
        // Sealed with another key, or cut short: Drive brings the edit anyway.
      });
  });
  channel.subscribe((status) => liveState.set(status === "SUBSCRIBED" ? "live" : status === "CLOSED" ? "off" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "error" : "connecting"));
  return {
    send(docId, update) {
      if (update.length > MAX_BYTES) return;
      void seal(key, update)
        .then((sealed) => channel.send({ type: "broadcast", event: "edit", payload: { docId, device, data: toBase64(sealed) } satisfies Edit }))
        .catch(() => {});
    },
    stop() {
      void supabase.removeChannel(channel);
      liveState.set("off");
    },
  };
}
