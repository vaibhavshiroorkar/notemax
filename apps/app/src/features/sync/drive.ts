import type { KeyCheck, RemoteEntry, SyncRemote } from "@notemax/core";
import { driveToken } from "./google";

// Google Drive's REST API, as the sync engine needs it. With the drive.file
// scope Notemax sees only what it made: one "Notemax" folder, a key check
// file, and one sealed file per doc and device, named "<docId>@<device>".

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "Notemax";
const FOLDER_TYPE = "application/vnd.google-apps.folder";
const KEY_FILE = "notemax-key.json";
const FILE_FIELDS = "id,name,parents,appProperties,trashed";

interface DriveFile {
  id: string;
  name: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
}

/** A Drive call with the current token. A 401 gets one more try with a fresh token. */
async function call(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await driveToken(retried);
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401 && !retried) return call(url, init, true);
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? "";
    } catch {
      // No JSON body; the status says enough.
    }
    throw new Error(`Google Drive answered ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  return res;
}

const json = async <T,>(url: string, init?: RequestInit) => (await call(url, init)).json() as Promise<T>;
const quote = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function findFiles(q: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FILE_FIELDS})`, pageSize: "1000", spaces: "drive" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await json<{ files: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
    out.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

/** Uploads a new file, or new content for an existing one. */
async function upload(body: Blob, metadata: Record<string, unknown>, id?: string): Promise<DriveFile> {
  if (id) {
    return json<DriveFile>(`${UPLOAD}/files/${id}?uploadType=media&fields=${FILE_FIELDS}`, { method: "PATCH", body });
  }
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", body);
  return json<DriveFile>(`${UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`, { method: "POST", body: form });
}

/** The Notemax folder, made on first use. */
export async function findFolder(create: boolean): Promise<string | null> {
  const found = await findFiles(`name = ${quote(FOLDER)} and mimeType = ${quote(FOLDER_TYPE)} and trashed = false`);
  if (found.length) return found[0].id;
  if (!create) return null;
  const folder = await json<DriveFile>(`${API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER, mimeType: FOLDER_TYPE }),
  });
  return folder.id;
}

/** The passphrase check kept in the folder, or null for a folder that has none yet. */
export async function readKeyCheck(folder: string): Promise<KeyCheck | null> {
  const [file] = await findFiles(`name = ${quote(KEY_FILE)} and ${quote(folder)} in parents and trashed = false`);
  if (!file) return null;
  return (await call(`${API}/files/${file.id}?alt=media`)).json() as Promise<KeyCheck>;
}

export async function writeKeyCheck(folder: string, check: KeyCheck) {
  await upload(new Blob([JSON.stringify(check)], { type: "application/json" }), { name: KEY_FILE, parents: [folder], mimeType: "application/json" });
}

const entryOf = (file: DriveFile): RemoteEntry | null => {
  const docId = file.appProperties?.doc;
  const device = file.appProperties?.device;
  return docId && device && !file.trashed ? { docId, device, ref: file.id } : null;
};

/** Whether any device has written docs to the folder yet. */
export async function folderHasDocs(folder: string, exceptDevice: string): Promise<boolean> {
  const files = await findFiles(`${quote(folder)} in parents and trashed = false`);
  return files.some((file) => {
    const entry = entryOf(file);
    return entry && entry.device !== exceptDevice;
  });
}

export function driveRemote(folder: string, device: string): SyncRemote {
  // This device's files by doc id, so a write replaces the file instead of adding another.
  const mine = new Map<string, string>();
  let mineLoading: Promise<void> | null = null;

  // Shared, so writes running side by side list the files once. A failed list is tried again.
  function loadMine() {
    mineLoading ??= findFiles(`${quote(folder)} in parents and trashed = false and appProperties has { key='device' and value=${quote(device)} }`).then(
      (files) => {
        for (const file of files) if (file.appProperties?.doc) mine.set(file.appProperties.doc, file.id);
      },
      (err) => {
        mineLoading = null;
        throw err;
      },
    );
    return mineLoading;
  }

  return {
    async changes(cursor) {
      if (cursor === null) {
        // First run: everything in the folder, then changes from this moment on.
        const { startPageToken } = await json<{ startPageToken: string }>(`${API}/changes/startPageToken`);
        const files = await findFiles(`${quote(folder)} in parents and trashed = false`);
        return { entries: files.map(entryOf).filter((e): e is RemoteEntry => !!e), cursor: startPageToken };
      }
      const entries = new Map<string, RemoteEntry>();
      let pageToken = cursor;
      for (;;) {
        const params = new URLSearchParams({ pageToken, spaces: "drive", pageSize: "1000", fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS}))` });
        const page = await json<{ changes: { fileId: string; removed?: boolean; file?: DriveFile }[]; nextPageToken?: string; newStartPageToken?: string }>(
          `${API}/changes?${params}`,
        );
        for (const change of page.changes) {
          const entry = change.file && change.file.parents?.includes(folder) ? entryOf(change.file) : null;
          // The latest change of a file is enough: its content is read now, not as it was then.
          if (entry) entries.set(entry.ref, entry);
        }
        if (page.newStartPageToken) return { entries: [...entries.values()], cursor: page.newStartPageToken };
        pageToken = page.nextPageToken!;
      }
    },

    async read(ref) {
      return new Uint8Array(await (await call(`${API}/files/${ref}?alt=media`)).arrayBuffer());
    },

    async write(docId, data) {
      await loadMine();
      const body = new Blob([data as BlobPart], { type: "application/octet-stream" });
      const metadata = { name: `${docId}@${device}`, parents: [folder], appProperties: { doc: docId, device }, mimeType: "application/octet-stream" };
      let file: DriveFile;
      try {
        file = await upload(body, metadata, mine.get(docId));
      } catch (err) {
        // Someone deleted the file in Drive: make it again.
        if (!mine.has(docId) || !String(err).includes(" 404")) throw err;
        file = await upload(body, metadata);
      }
      mine.set(docId, file.id);
    },

    async remove(docId) {
      await loadMine();
      const id = mine.get(docId);
      if (!id) return;
      await call(`${API}/files/${id}`, { method: "DELETE" });
      mine.delete(docId);
    },
  };
}
