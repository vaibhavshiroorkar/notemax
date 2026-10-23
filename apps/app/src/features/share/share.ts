import { importKey, setProp, type TreeNode } from "@notemax/core";
import type * as Y from "yjs";
import { isDesktop } from "@/platform/platform";

// A shared page has a link like https://notemax.pages.dev/#share=<room>.<key>.<verify>.<sign>.
// Everything is in the part after #, which browsers never send to any server.
// The key seals the page's text, so only people with a link can read it. Edits
// are signed: an edit link carries the signing key, a view link only the key
// that checks signatures, so someone with a view link can read but every other
// copy refuses edits from them. Links made before view links have no signing
// keys, and everyone with them can edit, as before.

const SHARE = "share";
/** Where people without the app open a link. The desktop app has no address of its own. */
const PUBLIC_APP = "https://notemax.pages.dev";

export interface Share {
  room: string;
  /** Base64url of a 256-bit AES key. */
  key: string;
  /** Base64url of the P-256 public key that checks edits. */
  verify?: string;
  /** Base64url of the matching private key (PKCS #8), on edit links only. */
  sign?: string;
}

/** Whether this copy may edit: it has the signing key, or the share has no signing at all. */
export const canEdit = (share: Share) => !share.verify || !!share.sign;

const SIGNING = { name: "ECDSA", namedCurve: "P-256" } as const;
export const SIGNATURE = { name: "ECDSA", hash: "SHA-256" } as const;
const fromB64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
export const verifyKeyOf = (share: Share) => (share.verify ? crypto.subtle.importKey("raw", fromB64url(share.verify), SIGNING, false, ["verify"]) : Promise.resolve(null));
export const signKeyOf = (share: Share) => (share.sign ? crypto.subtle.importKey("pkcs8", fromB64url(share.sign), SIGNING, false, ["sign"]) : Promise.resolve(null));

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64url = (text: string) => text.replace(/-/g, "+").replace(/_/g, "/");

const parse = (value: string): Share | null => {
  const [room, key, verify, sign] = value.split(".");
  if (!room || !key || ![room, key, verify ?? "", sign ?? ""].every((part) => /^[\w-]*$/.test(part))) return null;
  return { room, key, ...(verify ? { verify } : {}), ...(verify && sign ? { sign } : {}) };
};

const format = (share: Share) => [share.room, share.key, share.verify, share.sign].filter(Boolean).join(".");

export const shareOf = (node: TreeNode): Share | null => (typeof node.props[SHARE] === "string" ? parse(node.props[SHARE] as string) : null);

/** Starts sharing a page with a new room, key and pair of signing keys. Sharing again later makes all new links. */
export async function startSharing(doc: Y.Doc, pageId: string): Promise<Share> {
  const pair = (await crypto.subtle.generateKey(SIGNING, true, ["sign", "verify"])) as CryptoKeyPair;
  const share: Share = {
    room: base64url(crypto.getRandomValues(new Uint8Array(12))),
    key: base64url(crypto.getRandomValues(new Uint8Array(32))),
    verify: base64url(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))),
    sign: base64url(new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey))),
  };
  setProp(doc, pageId, SHARE, format(share));
  return share;
}

/** Stops this copy taking part. People who have the link keep what they have. */
export const stopSharing = (doc: Y.Doc, pageId: string) => setProp(doc, pageId, SHARE, null);

/** Keeps a share that came in through a link on the page made for it. */
export const keepShare = (doc: Y.Doc, pageId: string, share: Share) => setProp(doc, pageId, SHARE, format(share));

/** A link to the page: one that can edit, or one that can only read (without the signing key). */
export const linkOf = (share: Share, title: string, as: "edit" | "view" = "edit") =>
  `${isDesktop ? PUBLIC_APP : location.origin}/#share=${format(as === "view" ? { ...share, sign: undefined } : share)}${title ? `&t=${encodeURIComponent(title)}` : ""}`;

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
