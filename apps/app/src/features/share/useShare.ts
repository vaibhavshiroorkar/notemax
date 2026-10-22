import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import { renameNode, type TreeNode } from "@notemax/core";
import { accountView } from "@/features/account/session";
import { createStore } from "@/platform/store";
import { joinRoom, type Person, type Room } from "./room";
import { keyOf, shareOf } from "./share";

/** Who else has each shared page open, by page id. */
export const roomPeople = createStore<Record<string, Person[]>>({});
/** Shared pages whose room this window has joined, for the "waiting" note on an empty page. */
export const joinedRooms = createStore<Set<string>>(new Set());

const setPeople = (pageId: string, people: Person[] | null) => {
  const next = { ...roomPeople.get() };
  if (people) next[pageId] = people;
  else delete next[pageId];
  roomPeople.set(next);
};

const myName = () => {
  const view = accountView.get();
  return view.state === "in" ? view.name.split(/\s+/)[0] || view.name : "Someone";
};

/**
 * While a shared page is open, it takes part in its room: edits go both ways,
 * and the title follows the shared one, whoever changed it last.
 */
export function useShare(body: Y.Doc | undefined, node: TreeNode, workspaceDoc: Y.Doc) {
  const share = shareOf(node);
  const id = share ? `${share.room}.${share.key}` : null;
  const title = useRef(node.title);
  title.current = node.title;

  useEffect(() => {
    if (!body || !share) return;
    let room: Room | null = null;
    let live = true;
    keyOf(share)
      .then((key) => joinRoom(share, key, body, myName(), (people) => live && setPeople(node.id, people)))
      .then((joined) => {
        if (live) {
          room = joined;
          joinedRooms.set(new Set([...joinedRooms.get(), node.id]));
        } else joined.leave();
      })
      .catch((err) => console.warn("[notemax] could not join the shared page's room", err));
    return () => {
      live = false;
      room?.leave();
      setPeople(node.id, null);
      const rooms = new Set(joinedRooms.get());
      rooms.delete(node.id);
      joinedRooms.set(rooms);
    };
    // The share string stands for the share; a new object each render must not rejoin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, id, node.id]);

  // The shared title lives in the body doc, so it travels with the text.
  useEffect(() => {
    if (!body || !id) return;
    const meta = body.getMap<string>("share");
    const follow = () => {
      const shared = meta.get("title");
      if (typeof shared === "string" && shared && shared !== title.current) renameNode(workspaceDoc, node.id, shared);
    };
    follow();
    meta.observe(follow);
    return () => meta.unobserve(follow);
  }, [body, id, node.id, workspaceDoc]);

  useEffect(() => {
    if (!body || !id || !node.title) return;
    const meta = body.getMap<string>("share");
    if (meta.get("title") !== node.title) meta.set("title", node.title);
  }, [body, id, node.title]);
}
