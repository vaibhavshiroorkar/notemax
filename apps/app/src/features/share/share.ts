import { importKey, setProp, type TreeNode } from "@notemax/core";
import type * as Y from "yjs";
import { isDesktop } from "@/platform/platform";

// A shared page has a link like https://notemax.pages.dev/#share=<room>.<key>.
// The key is in the part after #, which browsers never send to any server, so
// the page's text, sealed with it, can only be read by people who have the link.

const SHARE = "share";
/** Where people without the app open a link. The desktop app has no address of its own. */
const PUBLIC_APP = "https://notemax.pages.dev";

export interface Share {
  room: string;
  /** Base64url of a 256-bit AES key. */
  key: string;
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64url = (text: string) => text.replace(/-/g, "+").replace(/_/g, "/");

const parse = (value: string): Share | null => {
  const [room, key] = value.split(".");
  return room && key && /^[\w-]+$/.test(room) && /^[\w-]+$/.test(key) ? { room, key } : null;
};

export const shareOf = (node: TreeNode): Share | null => (typeof node.props[SHARE] === "string" ? parse(node.props[SHARE] as string) : null);

/** Starts sharing a page with a new room and key. */
export function startSharing(doc: Y.Doc, pageId: string): Share {
  const share = { room: base64url(crypto.getRandomValues(new Uint8Array(12))), key: base64url(crypto.getRandomValues(new Uint8Array(32))) };
  setProp(doc, pageId, SHARE, `${share.room}.${share.key}`);
  return share;
}

/** Stops this copy taking part. People who have the link keep what they have. */
export const stopSharing = (doc: Y.Doc, pageId: string) => setProp(doc, pageId, SHARE, null);

/** Keeps a share that came in through a link on the page made for it. */
export const keepShare = (doc: Y.Doc, pageId: string, share: Share) => setProp(doc, pageId, SHARE, `${share.room}.${share.key}`);

export const linkOf = (share: Share, title: string) =>
  `${isDesktop ? PUBLIC_APP : location.origin}/#share=${share.room}.${share.key}${title ? `&t=${encodeURIComponent(title)}` : ""}`;

function shareInAddress(): { share: Share; title: string } | null {
  const params = new URLSearchParams(location.hash.slice(1));
  const share = parse(params.get("share") ?? "");
  return share ? { share, title: params.get("t") ?? "" } : null;
}

/**
 * The share this window was opened with, from a link. Read when the app first
 * loads, and taken out of the address at once: the address normally holds the
 * open page, and the key should not linger where it can be copied by mistake.
 */
export const shareFromLink = shareInAddress();
if (shareFromLink) history.replaceState(history.state, "", location.pathname + location.search);

export const keyOf = (share: Share): Promise<CryptoKey> => importKey(fromBase64url(share.key));
