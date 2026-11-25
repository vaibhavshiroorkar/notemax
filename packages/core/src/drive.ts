import type { KeyCheck } from "./crypt";
import { isHistoryDocId } from "./history";
import { inParallel, type RemoteEntry, type SyncRemote } from "./sync";
import { WORKSPACE_DOC_ID } from "./workspace";
import { splitScoped } from "./workspaces";

// Google Drive's REST API, as the sync engine needs it. With the drive.file
// scope Notemax sees only what it made: one "Notemax" root folder holding
// "notemax-key.json", a "system" folder for settings and workspace metadata,
// and "workspaces/<id>/" folders split into "pages", "history", and "assets".

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER = "Notemax";
const FOLDER_TYPE = "application/vnd.google-apps.folder";
const KEY_FILE = "notemax-key.json";
const FILE_FIELDS = "id,name,mimeType,parents,appProperties,trashed";
const ORGANIZE_PARALLEL = 5;

export interface DriveLocation {
  /** Subfolder path inside the Notemax root folder. */
  path: string[];
  /** File name inside that subfolder. */
  name: string;
}

/** Where a synced doc belongs in the Notemax Drive folder hierarchy. */
export function driveLocation(stored: string, device: string): DriveLocation {
  const { workspace, docId } = splitScoped(stored);
  if (workspace === null) return { path: ["system"], name: `${docId}@${device}` };
  if (docId === WORKSPACE_DOC_ID) return { path: ["workspaces", workspace], name: `${docId}@${device}` };
  if (isHistoryDocId(docId)) return { path: ["workspaces", workspace, "history"], name: `${docId.slice("history:".length)}@${device}` };
  if (docId.startsWith("asset:")) return { path: ["workspaces", workspace, "assets"], name: `${docId.slice("asset:".length)}@${device}` };
  return { path: ["workspaces", workspace, "pages"], name: `${docId}@${device}` };
}

export interface DriveRemote extends SyncRemote {
  /** Moves any legacy flat files or files in duplicate folders into their organized subfolders. */
  organize(signal?: AbortSignal): Promise<void>;
}

export interface DriveClient {
  findFolder(create: boolean): Promise<string | null>;
  readKeyCheck(folder: string): Promise<KeyCheck | null>;
  writeKeyCheck(folder: string, check: KeyCheck): Promise<void>;
  folderHasDocs(folder: string, exceptDevice: string): Promise<boolean>;
  driveRemote(folder: string, device: string): DriveRemote;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  trashed?: boolean;
}

interface FolderIndex {
  /** Canonical folder id by relative path ("" for the Notemax root). */
  byPath: Map<string, string>;
  /** All folder ids descending from the Notemax root, including any duplicates. */
  subtree: Set<string>;
  /** Duplicate folder ids whose files should be consolidated into their canonical folder. */
  duplicateFolderIds: string[];
}

interface MineEntry {
  id: string;
  parentId: string;
  parents: string[];
  name: string;
}

const quote = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const entryOf = (file: DriveFile): RemoteEntry | null => {
  const docId = file.appProperties?.doc;
  const device = file.appProperties?.device;
  return docId && device && !file.trashed ? { docId, device, ref: file.id } : null;
};

const isNotFound = (err: unknown) => /\b404\b/.test(String(err));

const isInSubtree = (parents: readonly string[] | undefined, subtree: ReadonlySet<string>) =>
  !!parents?.some((parent) => subtree.has(parent));

/** Builds the folder tree rooted at `rootId` from every folder visible to Notemax. */
function buildFolderIndex(rootId: string, allFolders: DriveFile[]): FolderIndex {
  const children = new Map<string, DriveFile[]>();
  for (const folder of allFolders) {
    for (const parent of folder.parents ?? []) {
      const list = children.get(parent) ?? [];
      list.push(folder);
      children.set(parent, list);
    }
  }
  const byPath = new Map<string, string>([["", rootId]]);
  const subtree = new Set<string>([rootId]);
  const duplicateFolderIds: string[] = [];
  const queue: { id: string; path: string; canonical: boolean }[] = [{ id: rootId, path: "", canonical: true }];
  const visited = new Set<string>([rootId]);

  while (queue.length) {
    const { id, path, canonical } = queue.shift()!;
    for (const child of children.get(id) ?? []) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      subtree.add(child.id);
      const childPath = path ? `${path}/${child.name}` : child.name;
      // Only children of the canonical parent count as canonical; anything inside a duplicate folder is consolidated later.
      const isCanonical = canonical && !byPath.has(childPath);
      if (isCanonical) byPath.set(childPath, child.id);
      else duplicateFolderIds.push(child.id);
      queue.push({ id: child.id, path: childPath, canonical: isCanonical });
    }
  }
  return { byPath, subtree, duplicateFolderIds };
}

export function createDriveClient(getToken: (force: boolean) => Promise<string>, fetchImpl: typeof fetch = globalThis.fetch): DriveClient {
  /** A Drive call with the current token. A 401 gets one more try with a fresh token. */
  async function call(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = await getToken(retried);
    const res = await fetchImpl(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
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

  async function findFiles(q: string, orderBy?: string): Promise<DriveFile[]> {
    const out: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParams({ q, fields: `nextPageToken,files(${FILE_FIELDS})`, pageSize: "1000", spaces: "drive" });
      if (orderBy) params.set("orderBy", orderBy);
      if (pageToken) params.set("pageToken", pageToken);
      const page = await json<{ files: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
      out.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return out;
  }

  async function scanFolderIndex(rootId: string): Promise<FolderIndex> {
    // Ordered by creation time so every device picks the oldest folder if two ever raced.
    const folders = await findFiles(`mimeType = ${quote(FOLDER_TYPE)} and trashed = false`, "createdTime");
    return buildFolderIndex(rootId, folders);
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

  /** Moves an existing file to `targetFolder` with `name` (optionally replacing its content too). */
  async function moveFile(file: Pick<DriveFile, "id" | "name" | "parents">, targetFolder: string, name: string, body?: Blob): Promise<DriveFile> {
    const params = new URLSearchParams({ fields: FILE_FIELDS });
    const parents = file.parents ?? [];
    if (!parents.includes(targetFolder)) params.set("addParents", targetFolder);
    const remove = parents.filter((parent) => parent !== targetFolder);
    if (remove.length) params.set("removeParents", remove.join(","));

    if (body) {
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify({ name })], { type: "application/json" }));
      form.append("file", body);
      return json<DriveFile>(`${UPLOAD}/files/${file.id}?uploadType=multipart&${params}`, { method: "PATCH", body: form });
    }
    const init: RequestInit =
      file.name !== name
        ? { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }
        : { method: "PATCH" };
    return json<DriveFile>(`${API}/files/${file.id}?${params}`, init);
  }

  return {
    async findFolder(create) {
      const found = await findFiles(`name = ${quote(FOLDER)} and mimeType = ${quote(FOLDER_TYPE)} and trashed = false`, "createdTime");
      if (found.length) return found[0].id;
      if (!create) return null;
      const folder = await json<DriveFile>(`${API}/files?fields=id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: FOLDER, mimeType: FOLDER_TYPE }),
      });
      return folder.id;
    },

    async readKeyCheck(folder) {
      const [file] = await findFiles(`name = ${quote(KEY_FILE)} and ${quote(folder)} in parents and trashed = false`);
      if (!file) return null;
      return (await call(`${API}/files/${file.id}?alt=media`)).json() as Promise<KeyCheck>;
    },

    async writeKeyCheck(folder, check) {
      await upload(new Blob([JSON.stringify(check)], { type: "application/json" }), { name: KEY_FILE, parents: [folder], mimeType: "application/json" });
    },

    async folderHasDocs(folder, exceptDevice) {
      const index = await scanFolderIndex(folder);
      let pageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          q: `trashed = false and mimeType != ${quote(FOLDER_TYPE)}`,
          fields: `nextPageToken,files(${FILE_FIELDS})`,
          pageSize: "1000",
          spaces: "drive",
        });
        if (pageToken) params.set("pageToken", pageToken);
        const page = await json<{ files: DriveFile[]; nextPageToken?: string }>(`${API}/files?${params}`);
        for (const file of page.files) {
          if (!isInSubtree(file.parents, index.subtree)) continue;
          const entry = entryOf(file);
          if (entry && entry.device !== exceptDevice) return true;
        }
        pageToken = page.nextPageToken;
      } while (pageToken);
      return false;
    },

    driveRemote(folder, device) {
      const mine = new Map<string, MineEntry>();
      let mineLoading: Promise<void> | null = null;
      let folderIndex: FolderIndex | null = null;
      let foldersLoading: Promise<FolderIndex> | null = null;
      const creatingFolders = new Map<string, Promise<string>>();
      let organizing: Promise<void> | null = null;
      // Parent ids already confirmed outside `folder`, so unrelated files don't re-scan folders on every poll.
      const foreignParents = new Set<string>();

      function resetFolderCache() {
        folderIndex = null;
        foldersLoading = null;
        foreignParents.clear();
      }

      function loadFolders(force = false): Promise<FolderIndex> {
        if (force) resetFolderCache();
        if (folderIndex) return Promise.resolve(folderIndex);
        foldersLoading ??= scanFolderIndex(folder).then(
          (index) => {
            folderIndex = index;
            foreignParents.clear();
            return index;
          },
          (err) => {
            foldersLoading = null;
            throw err;
          },
        );
        return foldersLoading;
      }

      async function ensureFolder(segments: string[]): Promise<string> {
        const index = await loadFolders();
        let parentId = folder;
        for (let i = 0; i < segments.length; i++) {
          const key = segments.slice(0, i + 1).join("/");
          const cached = index.byPath.get(key);
          if (cached) {
            parentId = cached;
            continue;
          }
          let pending = creatingFolders.get(key);
          if (!pending) {
            const pId = parentId;
            const name = segments[i];
            pending = (async () => {
              const found = await findFiles(
                `name = ${quote(name)} and ${quote(pId)} in parents and mimeType = ${quote(FOLDER_TYPE)} and trashed = false`,
                "createdTime",
              );
              let id = found[0]?.id;
              if (!id) {
                const created = await json<DriveFile>(`${API}/files?fields=id`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, parents: [pId], mimeType: FOLDER_TYPE }),
                });
                id = created.id;
              }
              index.byPath.set(key, id);
              index.subtree.add(id);
              return id;
            })().finally(() => creatingFolders.delete(key));
            creatingFolders.set(key, pending);
          }
          parentId = await pending;
        }
        return parentId;
      }

      // Shared, so writes running side by side list the files once. A failed list is tried again.
      function loadMine() {
        mineLoading ??= Promise.all([
          loadFolders(),
          findFiles(`trashed = false and mimeType != ${quote(FOLDER_TYPE)} and appProperties has { key='device' and value=${quote(device)} }`),
        ]).then(
          ([index, files]) => {
            for (const file of files) {
              const docId = file.appProperties?.doc;
              if (!docId || !isInSubtree(file.parents, index.subtree)) continue;
              mine.set(docId, {
                id: file.id,
                parentId: file.parents?.[0] ?? "",
                parents: file.parents ?? [],
                name: file.name,
              });
            }
          },
          (err) => {
            mineLoading = null;
            throw err;
          },
        );
        return mineLoading;
      }

      async function createInFolder(body: Blob, path: string[], name: string, docId: string): Promise<DriveFile> {
        const targetFolder = await ensureFolder(path);
        const metadata = { name, parents: [targetFolder], appProperties: { doc: docId, device }, mimeType: "application/octet-stream" };
        try {
          return await upload(body, metadata);
        } catch (err) {
          // A cached subfolder was removed in Drive: refresh the folder tree and recreate it once.
          if (!isNotFound(err)) throw err;
          await loadFolders(true);
          const freshFolder = await ensureFolder(path);
          return await upload(body, { ...metadata, parents: [freshFolder] });
        }
      }

      function organize(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) return Promise.resolve();
        organizing ??= (async () => {
          const [index] = await Promise.all([loadFolders(), loadMine()]);
          const scanRoots = [folder, ...index.duplicateFolderIds];
          const misplaced: DriveFile[] = [];
          for (const parentId of scanRoots) {
            if (signal?.aborted) return;
            const files = await findFiles(`${quote(parentId)} in parents and trashed = false and mimeType != ${quote(FOLDER_TYPE)}`);
            for (const file of files) if (entryOf(file)) misplaced.push(file);
          }
          if (!misplaced.length) return;
          await inParallel(
            misplaced,
            async (file) => {
              if (signal?.aborted) return;
              const entry = entryOf(file)!;
              const { path, name } = driveLocation(entry.docId, entry.device);
              const targetFolder = await ensureFolder(path);
              const parents = file.parents ?? [];
              if (parents.length === 1 && parents[0] === targetFolder && file.name === name) return;
              try {
                const updated = await moveFile(file, targetFolder, name);
                if (entry.device === device) {
                  mine.set(entry.docId, {
                    id: updated.id,
                    parentId: targetFolder,
                    parents: updated.parents ?? [targetFolder],
                    name: updated.name,
                  });
                }
              } catch (err) {
                // Another device may have removed the file while we were organizing; skip it.
                if (!isNotFound(err)) throw err;
              }
            },
            ORGANIZE_PARALLEL,
          );
        })().finally(() => (organizing = null));
        return organizing;
      }

      return {
        organize,

        async changes(cursor) {
          if (cursor === null) {
            // Token first, so changes written during the initial list are picked up next time.
            const { startPageToken } = await json<{ startPageToken: string }>(`${API}/changes/startPageToken`);
            const [index, files] = await Promise.all([
              loadFolders(true),
              findFiles(`trashed = false and mimeType != ${quote(FOLDER_TYPE)}`),
            ]);
            const entries = files
              .filter((file) => isInSubtree(file.parents, index.subtree))
              .map(entryOf)
              .filter((e): e is RemoteEntry => !!e);
            return { entries, cursor: startPageToken };
          }

          let index = await loadFolders();
          const entries = new Map<string, RemoteEntry>();
          const pendingCheck: { file: DriveFile; entry: RemoteEntry }[] = [];
          let sawFolderChange = false;
          let sawRootDoc = false;
          let pageToken = cursor;

          for (;;) {
            const params = new URLSearchParams({
              pageToken,
              spaces: "drive",
              pageSize: "1000",
              fields: `nextPageToken,newStartPageToken,changes(fileId,removed,file(${FILE_FIELDS}))`,
            });
            const page = await json<{ changes: { fileId: string; removed?: boolean; file?: DriveFile }[]; nextPageToken?: string; newStartPageToken?: string }>(
              `${API}/changes?${params}`,
            );
            for (const change of page.changes) {
              const file = change.file;
              if (!file) continue;
              if (file.mimeType === FOLDER_TYPE) {
                sawFolderChange = true;
                if (!file.trashed && isInSubtree(file.parents, index.subtree)) index.subtree.add(file.id);
                continue;
              }
              const entry = entryOf(file);
              if (!entry) continue;
              if (isInSubtree(file.parents, index.subtree)) {
                entries.set(entry.ref, entry);
                if (file.parents?.includes(folder)) sawRootDoc = true;
              } else if (file.parents?.some((p) => !foreignParents.has(p))) {
                pendingCheck.push({ file, entry });
              }
            }
            if (page.newStartPageToken) {
              if (pendingCheck.length || sawFolderChange) {
                // Another device may have added a new workspace folder; refresh once to resolve unknown parents.
                if (pendingCheck.length) index = await loadFolders(true);
                for (const { file, entry } of pendingCheck) {
                  if (isInSubtree(file.parents, index.subtree)) {
                    entries.set(entry.ref, entry);
                    if (file.parents?.includes(folder)) sawRootDoc = true;
                  } else {
                    for (const p of file.parents ?? []) foreignParents.add(p);
                  }
                }
              }
              // If an older un-updated device wrote a flat file to the root, tidy it into its subfolder.
              if (sawRootDoc) void organize().catch(() => {});
              return { entries: [...entries.values()], cursor: page.newStartPageToken };
            }
            pageToken = page.nextPageToken!;
          }
        },

        async read(ref) {
          return new Uint8Array(await (await call(`${API}/files/${ref}?alt=media`)).arrayBuffer());
        },

        async write(docId, data) {
          const { path, name } = driveLocation(docId, device);
          const [, targetFolder] = await Promise.all([loadMine(), ensureFolder(path)]);
          const body = new Blob([data as BlobPart], { type: "application/octet-stream" });
          const existing = mine.get(docId);
          let file: DriveFile;
          if (existing) {
            try {
              const needsMove = existing.parentId !== targetFolder || existing.parents.length !== 1 || existing.name !== name;
              file = needsMove
                ? await moveFile(existing, targetFolder, name, body)
                : await upload(body, { name, appProperties: { doc: docId, device } }, existing.id);
            } catch (err) {
              // Someone deleted the file (or its subfolder) in Drive: make it again.
              if (!isNotFound(err)) throw err;
              file = await createInFolder(body, path, name, docId);
            }
          } else {
            file = await createInFolder(body, path, name, docId);
          }
          mine.set(docId, {
            id: file.id,
            parentId: targetFolder,
            parents: file.parents ?? [targetFolder],
            name: file.name,
          });
        },

        async listMine() {
          await loadMine();
          return [...mine.keys()];
        },

        async remove(docId) {
          await loadMine();
          const existing = mine.get(docId);
          if (!existing) return;
          try {
            await call(`${API}/files/${existing.id}`, { method: "DELETE" });
          } catch (err) {
            if (!isNotFound(err)) throw err;
          }
          mine.delete(docId);
        },
      };
    },
  };
}
