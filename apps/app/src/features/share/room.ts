import * as Y from "yjs";
import { seal, unseal } from "@notemax/core";
import type { Share } from "./share";

// Everyone with a shared page open meets in a Realtime room. Joining, each
// says what it has (a state vector) and the others answer with what it lacks,
// so two copies edited apart catch up. Then every edit goes to the room as it
// happens. All of it is sealed with the page's key; the room only relays.

/** Edits that came from the room, so they are not sent back to it. */
const FROM_ROOM = Symbol("room");

// Realtime caps a message well under a megabyte, so big ones go in parts.
const PART = 60_000;
// How long typing gathers before it goes out: quick to the eye, few messages.
const BATCH_MS = 150;

type Message =
  | { t: "hello"; from: string; sv: string; reply?: boolean }
  | { t: "data"; from: string; id: string; i: number; n: number; part: string };

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export interface Person {
  id: string;
  name: string;
}

export interface Room {
  leave(): void;
}

/** Joins the page's room with its body doc. `onPeople` hears who else has it open. */
export async function joinRoom(share: Share, key: CryptoKey, doc: Y.Doc, name: string, onPeople: (people: Person[]) => void): Promise<Room> {
  const { supabase } = await import("@/features/account/client");
  const me = crypto.randomUUID();
  const channel = supabase.channel(`notemax-share-${share.room}`, { config: { broadcast: { self: false }, presence: { key: me } } });
  const parts = new Map<string, string[]>();

  const send = (message: Message) => void channel.send({ type: "broadcast", event: "m", payload: message });
  const sendUpdate = async (update: Uint8Array) => {
    const data = toBase64(await seal(key, update));
    const id = crypto.randomUUID();
    const n = Math.ceil(data.length / PART) || 1;
    for (let i = 0; i < n; i++) send({ t: "data", from: me, id, i, n, part: data.slice(i * PART, (i + 1) * PART) });
  };
  const hello = (reply = false) => send({ t: "hello", from: me, sv: toBase64(Y.encodeStateVector(doc)), reply });

  channel.on("broadcast", { event: "m" }, ({ payload }: { payload: Message }) => {
    if (payload.from === me) return;
    if (payload.t === "hello") {
      // What they lack, then what we lack, unless this was already an answer.
      void sendUpdate(Y.encodeStateAsUpdate(doc, fromBase64(payload.sv)));
      if (!payload.reply) hello(true);
      return;
    }
    const got = parts.get(payload.id) ?? new Array<string>(payload.n);
    got[payload.i] = payload.part;
    parts.set(payload.id, got);
    if (got.filter(Boolean).length < payload.n) return;
    parts.delete(payload.id);
    unseal(key, fromBase64(got.join("")))
      .then((update) => Y.applyUpdate(doc, update, FROM_ROOM))
      .catch(() => {
        // Sealed with another key: not this page's room after all.
      });
  });
  channel.on("presence", { event: "sync" }, () => {
    const people = Object.entries(channel.presenceState<{ name: string }>())
      .filter(([id]) => id !== me)
      .map(([id, metas]) => ({ id, name: metas[0]?.name ?? "Someone" }));
    onPeople(people);
  });

  // Keystrokes go out in small batches: Realtime limits how many messages a
  // client may send each second, and drops the rest when typing is fast.
  let pending: Uint8Array[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    if (pending.length) void sendUpdate(Y.mergeUpdates(pending));
    pending = [];
  };
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === FROM_ROOM) return;
    pending.push(update);
    timer ??= setTimeout(flush, BATCH_MS);
  };
  doc.on("update", onUpdate);
  channel.subscribe((status) => {
    if (status !== "SUBSCRIBED") return;
    void channel.track({ name });
    hello();
  });

  return {
    leave() {
      doc.off("update", onUpdate);
      clearTimeout(timer);
      flush();
      void supabase.removeChannel(channel);
    },
  };
}
