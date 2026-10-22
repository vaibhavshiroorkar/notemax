// End-to-end encryption for synced files: what reaches Google Drive is
// unreadable without the passphrase, which never leaves the user's devices.
//
// The key comes from the passphrase through PBKDF2 (SHA-256, many rounds, so
// guessing is slow), and each file is sealed with AES-GCM, which also detects
// any change to the file. A sealed file is: a version byte, a 12-byte random
// IV, then the ciphertext.

const VERSION = 1;
const ROUNDS = 600_000;
const IV_BYTES = 12;

/** Turns a passphrase into the key for this sync folder. `salt` is stored next to the files, and is not secret. */
export async function deriveKey(passphrase: string, salt: Uint8Array, rounds = ROUNDS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: rounds },
    base,
    { name: "AES-GCM", length: 256 },
    // Extractable, so the device can keep it and not ask for the passphrase on every start.
    true,
    ["encrypt", "decrypt"],
  );
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function seal(key: CryptoKey, plain: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(IV_BYTES);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain as BufferSource));
  const out = new Uint8Array(1 + IV_BYTES + sealed.length);
  out[0] = VERSION;
  out.set(iv, 1);
  out.set(sealed, 1 + IV_BYTES);
  return out;
}

/** Throws when the key is wrong or the file was changed or cut short. */
export async function open(key: CryptoKey, sealed: Uint8Array): Promise<Uint8Array> {
  if (sealed[0] !== VERSION) throw new Error(`unknown file version ${sealed[0]}`);
  const iv = sealed.subarray(1, 1 + IV_BYTES);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, sealed.subarray(1 + IV_BYTES) as BufferSource));
}

/**
 * What the sync folder keeps to check a passphrase on a new device: the salt,
 * the rounds, and a known text sealed with the key.
 */
export interface KeyCheck {
  salt: string;
  rounds: number;
  check: string;
}

const CHECK_TEXT = "notemax key check";

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** A new key for a new sync folder, with the check to store beside the files. */
export async function newKey(passphrase: string, rounds = ROUNDS): Promise<{ key: CryptoKey; check: KeyCheck }> {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, rounds);
  const sealed = await seal(key, new TextEncoder().encode(CHECK_TEXT));
  return { key, check: { salt: toBase64(salt), rounds, check: toBase64(sealed) } };
}

/** The key for an existing sync folder, or null when the passphrase is wrong. */
export async function unlockKey(passphrase: string, check: KeyCheck): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, fromBase64(check.salt), check.rounds);
  try {
    const text = new TextDecoder().decode(await open(key, fromBase64(check.check)));
    return text === CHECK_TEXT ? key : null;
  } catch {
    return null;
  }
}

/** The raw key as text, to keep on this device. */
export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromBase64(raw) as BufferSource, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
