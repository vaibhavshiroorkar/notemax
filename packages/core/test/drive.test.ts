import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  SETTINGS_DOC_ID,
  WORKSPACES_DOC_ID,
  WORKSPACE_DOC_ID,
  createDriveClient,
  createMemoryStore,
  createSyncEngine,
  driveLocation,
  newKey,
  openLocalDoc,
  type SyncState,
} from "../src";

const FOLDER_TYPE = "application/vnd.google-apps.folder";
const ROUNDS = 1000;

interface StoredDriveFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties?: Record<string, string>;
  trashed: boolean;
  createdTime: number;
  content: Uint8Array;
}

/**
 * In-memory Google Drive v3 REST API simulator for testing folder hierarchy,
 * concurrent folder creation, incremental changes, and legacy file migration.
 */
class FakeGoogleDrive {
  files = new Map<string, StoredDriveFile>();
  changes: { seq: number; fileId: string }[] = [];
  seq = 0;
  nextId = 1;
  requests: { method: string; path: string; search: string }[] = [];
  failNext401 = false;

  seedFolder(name: string, parentId?: string, createdTime = ++this.seq): string {
    const id = `f_${this.nextId++}`;
    this.files.set(id, {
      id,
      name,
      mimeType: FOLDER_TYPE,
      parents: parentId ? [parentId] : [],
      trashed: false,
      createdTime,
      content: new Uint8Array(),
    });
    this.changes.push({ seq: ++this.seq, fileId: id });
    return id;
  }

  seedFile(
    name: string,
    parents: string[],
    content: Uint8Array,
    appProperties?: Record<string, string>,
    mimeType = "application/octet-stream",
  ): string {
    const id = `file_${this.nextId++}`;
    this.files.set(id, {
      id,
      name,
      mimeType,
      parents: [...parents],
      appProperties,
      trashed: false,
      createdTime: ++this.seq,
      content,
    });
    this.changes.push({ seq: ++this.seq, fileId: id });
    return id;
  }

  /** Path from the Notemax root folder down to `file`, e.g. "workspaces/main/pages/note@dev". */
  pathOf(fileId: string, rootId: string): string {
    const file = this.files.get(fileId)!;
    const segments = [file.name];
    let cur = file.parents[0];
    while (cur && cur !== rootId) {
      const parent = this.files.get(cur);
      if (!parent) break;
      segments.unshift(parent.name);
      cur = parent.parents[0];
    }
    return segments.join("/");
  }

  private matches(file: StoredDriveFile, q: string): boolean {
    // Split on top-level "and" only, leaving "and" inside appProperties { ... } intact.
    const clauses = q.split(/\s+and\s+(?![^{]*\})/);
    for (const raw of clauses) {
      const clause = raw.trim();
      if (clause === "trashed = false") {
        if (file.trashed) return false;
      } else if (clause.startsWith("name = ")) {
        const expected = unquote(clause.slice("name = ".length));
        if (file.name !== expected) return false;
      } else if (clause.startsWith("mimeType = ")) {
        const expected = unquote(clause.slice("mimeType = ".length));
        if (file.mimeType !== expected) return false;
      } else if (clause.startsWith("mimeType != ")) {
        const excluded = unquote(clause.slice("mimeType != ".length));
        if (file.mimeType === excluded) return false;
      } else if (clause.endsWith(" in parents")) {
        const parent = unquote(clause.slice(0, -" in parents".length));
        if (!file.parents.includes(parent)) return false;
      } else if (clause.startsWith("appProperties has ")) {
        const match = clause.match(/key='([^']+)'\s+and\s+value=('[^']*')\s*\}$/);
        if (!match) throw new Error(`Unsupported appProperties clause: ${clause}`);
        const [, key, rawValue] = match;
        if (file.appProperties?.[key] !== unquote(rawValue)) return false;
      } else {
        throw new Error(`Unsupported query clause: ${clause}`);
      }
    }
    return true;
  }

  private toJson(file: StoredDriveFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      parents: file.parents,
      appProperties: file.appProperties,
      trashed: file.trashed,
    };
  }

  fetch: typeof fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init.method ?? "GET").toUpperCase();
    this.requests.push({ method, path: url.pathname, search: url.search });

    if (this.failNext401) {
      this.failNext401 = false;
      return jsonResponse(401, { error: { message: "Invalid Credentials" } });
    }

    // GET /drive/v3/changes/startPageToken
    if (method === "GET" && url.pathname === "/drive/v3/changes/startPageToken") {
      return jsonResponse(200, { startPageToken: String(this.seq) });
    }

    // GET /drive/v3/changes
    if (method === "GET" && url.pathname === "/drive/v3/changes") {
      const since = Number(url.searchParams.get("pageToken") ?? "0");
      const changes = this.changes
        .filter((c) => c.seq > since)
        .map((c) => {
          const file = this.files.get(c.fileId);
          return file ? { fileId: c.fileId, file: this.toJson(file) } : { fileId: c.fileId, removed: true };
        });
      return jsonResponse(200, { changes, newStartPageToken: String(this.seq) });
    }

    // GET /drive/v3/files
    if (method === "GET" && url.pathname === "/drive/v3/files") {
      const q = url.searchParams.get("q") ?? "";
      let list = [...this.files.values()].filter((f) => this.matches(f, q));
      if (url.searchParams.get("orderBy") === "createdTime") {
        list = list.sort((a, b) => a.createdTime - b.createdTime);
      }
      return jsonResponse(200, { files: list.map((f) => this.toJson(f)) });
    }

    // GET /drive/v3/files/:id?alt=media
    const fileMatch = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (method === "GET" && fileMatch && url.searchParams.get("alt") === "media") {
      const file = this.files.get(fileMatch[1]);
      if (!file || file.trashed) return jsonResponse(404, { error: { message: "File not found" } });
      return new Response(new Uint8Array(file.content), { status: 200 });
    }

    // POST /drive/v3/files (create folder)
    if (method === "POST" && url.pathname === "/drive/v3/files") {
      const meta = JSON.parse(String(init.body ?? "{}")) as { name: string; parents?: string[]; mimeType: string };
      for (const p of meta.parents ?? []) {
        if (!this.files.has(p)) return jsonResponse(404, { error: { message: "Parent not found" } });
      }
      const id = `f_${this.nextId++}`;
      const created: StoredDriveFile = {
        id,
        name: meta.name,
        mimeType: meta.mimeType,
        parents: meta.parents ?? [],
        trashed: false,
        createdTime: ++this.seq,
        content: new Uint8Array(),
      };
      this.files.set(id, created);
      this.changes.push({ seq: ++this.seq, fileId: id });
      return jsonResponse(200, this.toJson(created));
    }

    // PATCH /drive/v3/files/:id (move/rename metadata)
    if (method === "PATCH" && fileMatch) {
      const file = this.files.get(fileMatch[1]);
      if (!file || file.trashed) return jsonResponse(404, { error: { message: "File not found" } });
      applyParentChanges(file, url.searchParams);
      if (init.body) {
        const meta = JSON.parse(String(init.body)) as { name?: string };
        if (meta.name !== undefined) file.name = meta.name;
      }
      this.changes.push({ seq: ++this.seq, fileId: file.id });
      return jsonResponse(200, this.toJson(file));
    }

    // DELETE /drive/v3/files/:id
    if (method === "DELETE" && fileMatch) {
      const file = this.files.get(fileMatch[1]);
      if (!file) return jsonResponse(404, { error: { message: "File not found" } });
      this.files.delete(file.id);
      this.changes.push({ seq: ++this.seq, fileId: file.id });
      return new Response(null, { status: 204 });
    }

    // POST /upload/drive/v3/files?uploadType=multipart
    if (method === "POST" && url.pathname === "/upload/drive/v3/files") {
      const { metadata, bytes } = await parseMultipart(init.body as FormData);
      for (const p of metadata.parents ?? []) {
        if (!this.files.has(p)) return jsonResponse(404, { error: { message: "Parent not found" } });
      }
      const id = `file_${this.nextId++}`;
      const created: StoredDriveFile = {
        id,
        name: metadata.name!,
        mimeType: metadata.mimeType ?? "application/octet-stream",
        parents: metadata.parents ?? [],
        appProperties: metadata.appProperties,
        trashed: false,
        createdTime: ++this.seq,
        content: bytes,
      };
      this.files.set(id, created);
      this.changes.push({ seq: ++this.seq, fileId: id });
      return jsonResponse(200, this.toJson(created));
    }

    // PATCH /upload/drive/v3/files/:id
    const uploadMatch = url.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if (method === "PATCH" && uploadMatch) {
      const file = this.files.get(uploadMatch[1]);
      if (!file || file.trashed) return jsonResponse(404, { error: { message: "File not found" } });
      const uploadType = url.searchParams.get("uploadType");
      if (uploadType === "media") {
        file.content = new Uint8Array(await (init.body as Blob).arrayBuffer());
      } else {
        applyParentChanges(file, url.searchParams);
        const { metadata, bytes } = await parseMultipart(init.body as FormData);
        if (metadata.name !== undefined) file.name = metadata.name;
        file.content = bytes;
      }
      this.changes.push({ seq: ++this.seq, fileId: file.id });
      return jsonResponse(200, this.toJson(file));
    }

    throw new Error(`Unhandled request: ${method} ${url.pathname}${url.search}`);
  };
}

function applyParentChanges(file: StoredDriveFile, params: URLSearchParams) {
  const remove = params.get("removeParents");
  if (remove) {
    const drop = new Set(remove.split(","));
    file.parents = file.parents.filter((p) => !drop.has(p));
  }
  const add = params.get("addParents");
  if (add) {
    for (const p of add.split(",")) if (!file.parents.includes(p)) file.parents.push(p);
  }
}

async function parseMultipart(form: FormData) {
  const metaBlob = form.get("metadata") as Blob;
  const fileBlob = form.get("file") as Blob;
  const metadata = JSON.parse(await metaBlob.text()) as {
    name?: string;
    parents?: string[];
    appProperties?: Record<string, string>;
    mimeType?: string;
  };
  const bytes = new Uint8Array(await fileBlob.arrayBuffer());
  return { metadata, bytes };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const unquote = (raw: string) => {
  const trimmed = raw.trim();
  return trimmed.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
};

const bytesOf = (text: string) => new TextEncoder().encode(text);
const textOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("driveLocation", () => {
  it("maps every doc kind to its organized subfolder and clean filename", () => {
    expect(driveLocation(SETTINGS_DOC_ID, "dev1")).toEqual({ path: ["system"], name: "settings@dev1" });
    expect(driveLocation(WORKSPACES_DOC_ID, "dev1")).toEqual({ path: ["system"], name: "workspaces@dev1" });
    expect(driveLocation(WORKSPACE_DOC_ID, "dev1")).toEqual({ path: ["workspaces", "main"], name: "workspace@dev1" });
    expect(driveLocation("note-1", "dev1")).toEqual({ path: ["workspaces", "main", "pages"], name: "note-1@dev1" });
    expect(driveLocation("history:note-1", "dev1")).toEqual({ path: ["workspaces", "main", "history"], name: "note-1@dev1" });
    expect(driveLocation("asset:abc123", "dev1")).toEqual({ path: ["workspaces", "main", "assets"], name: "abc123@dev1" });
    expect(driveLocation("ws:work1:workspace", "dev1")).toEqual({ path: ["workspaces", "work1"], name: "workspace@dev1" });
    expect(driveLocation("ws:work1:note-2", "dev1")).toEqual({ path: ["workspaces", "work1", "pages"], name: "note-2@dev1" });
    expect(driveLocation("ws:work1:history:note-2", "dev1")).toEqual({ path: ["workspaces", "work1", "history"], name: "note-2@dev1" });
    expect(driveLocation("ws:work1:asset:def456", "dev1")).toEqual({ path: ["workspaces", "work1", "assets"], name: "def456@dev1" });
  });
});

describe("createDriveClient", () => {
  it("writes new docs into organized subfolders without creating duplicate folders under parallel writes", async () => {
    const api = new FakeGoogleDrive();
    const client = createDriveClient(async () => "tok", api.fetch);
    const root = (await client.findFolder(true))!;
    const remote = client.driveRemote(root, "laptop");

    await Promise.all([
      remote.write(SETTINGS_DOC_ID, bytesOf("s")),
      remote.write(WORKSPACES_DOC_ID, bytesOf("ws")),
      remote.write(WORKSPACE_DOC_ID, bytesOf("main-tree")),
      ...Array.from({ length: 10 }, (_, i) => remote.write(`page-${i}`, bytesOf(`body-${i}`))),
      remote.write("history:page-0", bytesOf("h0")),
      remote.write("asset:hash1", bytesOf("img1")),
      remote.write("ws:book2:workspace", bytesOf("b2-tree")),
      remote.write("ws:book2:ch-1", bytesOf("ch1")),
      remote.write("ws:book2:history:ch-1", bytesOf("ch1-h")),
      remote.write("ws:book2:asset:hash2", bytesOf("img2")),
    ]);

    const paths = [...api.files.values()]
      .filter((f) => f.mimeType !== FOLDER_TYPE)
      .map((f) => api.pathOf(f.id, root))
      .sort();

    expect(paths).toContain("system/settings@laptop");
    expect(paths).toContain("system/workspaces@laptop");
    expect(paths).toContain("workspaces/main/workspace@laptop");
    expect(paths).toContain("workspaces/main/pages/page-0@laptop");
    expect(paths).toContain("workspaces/main/pages/page-9@laptop");
    expect(paths).toContain("workspaces/main/history/page-0@laptop");
    expect(paths).toContain("workspaces/main/assets/hash1@laptop");
    expect(paths).toContain("workspaces/book2/workspace@laptop");
    expect(paths).toContain("workspaces/book2/pages/ch-1@laptop");
    expect(paths).toContain("workspaces/book2/history/ch-1@laptop");
    expect(paths).toContain("workspaces/book2/assets/hash2@laptop");

    // Exactly one folder per path segment — no duplicates from concurrent writes.
    const folders = [...api.files.values()].filter((f) => f.mimeType === FOLDER_TYPE && f.id !== root);
    const folderPaths = folders.map((f) => api.pathOf(f.id, root)).sort();
    expect(folderPaths).toEqual([
      "system",
      "workspaces",
      "workspaces/book2",
      "workspaces/book2/assets",
      "workspaces/book2/history",
      "workspaces/book2/pages",
      "workspaces/main",
      "workspaces/main/assets",
      "workspaces/main/history",
      "workspaces/main/pages",
    ]);

    // Subsequent updates to an already-organized file use media-only PATCH.
    api.requests.length = 0;
    await remote.write("page-0", bytesOf("body-0-v2"));
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0].method).toBe("PATCH");
    expect(api.requests[0].search).toContain("uploadType=media");
  });

  it("organizes older flat files across devices and workspaces while keeping notemax-key.json at root", async () => {
    const api = new FakeGoogleDrive();
    const root = api.seedFolder("Notemax");
    const otherRoot = api.seedFolder("Notemax-old");

    // Seed key check and legacy flat files from multiple devices directly in Notemax/.
    const keyId = api.seedFile("notemax-key.json", [root], bytesOf('{"salt":"a","rounds":1,"check":"b"}'), undefined, "application/json");
    api.seedFile("settings@phone", [root], bytesOf("p-set"), { doc: "settings", device: "phone" });
    api.seedFile("workspaces@laptop", [root], bytesOf("l-ws"), { doc: "workspaces", device: "laptop" });
    api.seedFile("workspace@phone", [root], bytesOf("p-tree"), { doc: "workspace", device: "phone" });
    api.seedFile("welcome@phone", [root], bytesOf("hello"), { doc: "welcome", device: "phone" });
    api.seedFile("history:welcome@phone", [root], bytesOf("h-hello"), { doc: "history:welcome", device: "phone" });
    api.seedFile("asset:deadbeef@laptop", [root], bytesOf("png"), { doc: "asset:deadbeef", device: "laptop" });
    api.seedFile("ws:novel:workspace@laptop", [root], bytesOf("n-tree"), { doc: "ws:novel:workspace", device: "laptop" });
    api.seedFile("ws:novel:ch1@laptop", [root], bytesOf("ch1"), { doc: "ws:novel:ch1", device: "laptop" });
    api.seedFile("ws:novel:history:ch1@phone", [root], bytesOf("h-ch1"), { doc: "ws:novel:history:ch1", device: "phone" });
    api.seedFile("ws:novel:asset:cafe123@phone", [root], bytesOf("svg"), { doc: "ws:novel:asset:cafe123", device: "phone" });
    // Stray file in another unrelated folder must never be touched.
    const strayId = api.seedFile("stray@phone", [otherRoot], bytesOf("stray"), { doc: "stray", device: "phone" });

    const client = createDriveClient(async () => "tok", api.fetch);
    const remote = client.driveRemote(root, "laptop");

    await remote.organize();

    // Key file stayed in Notemax root; all legacy doc files moved into their organized folders.
    expect(api.pathOf(keyId, root)).toBe("notemax-key.json");
    expect(api.files.get(strayId)!.parents).toEqual([otherRoot]);

    const rootDirectFiles = [...api.files.values()].filter((f) => f.mimeType !== FOLDER_TYPE && f.parents.includes(root));
    expect(rootDirectFiles.map((f) => f.name)).toEqual(["notemax-key.json"]);

    const organizedPaths = [...api.files.values()]
      .filter((f) => f.mimeType !== FOLDER_TYPE && f.id !== keyId && f.id !== strayId)
      .map((f) => api.pathOf(f.id, root))
      .sort();
    expect(organizedPaths).toEqual([
      "system/settings@phone",
      "system/workspaces@laptop",
      "workspaces/main/assets/deadbeef@laptop",
      "workspaces/main/history/welcome@phone",
      "workspaces/main/pages/welcome@phone",
      "workspaces/main/workspace@phone",
      "workspaces/novel/assets/cafe123@phone",
      "workspaces/novel/history/ch1@phone",
      "workspaces/novel/pages/ch1@laptop",
      "workspaces/novel/workspace@laptop",
    ]);

    // Second run is a clean no-op: only 1 files.list check on the root folder.
    api.requests.length = 0;
    await remote.organize();
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0].method).toBe("GET");
  });

  it("consolidates files from duplicate folders created by racing devices", async () => {
    const api = new FakeGoogleDrive();
    const root = api.seedFolder("Notemax");
    const wsFolder = api.seedFolder("workspaces", root);
    const mainFolder = api.seedFolder("main", wsFolder);
    const pagesOlder = api.seedFolder("pages", mainFolder, 10);
    const pagesNewer = api.seedFolder("pages", mainFolder, 20);

    const f1 = api.seedFile("n1@phone", [pagesOlder], bytesOf("1"), { doc: "n1", device: "phone" });
    const f2 = api.seedFile("n2@laptop", [pagesNewer], bytesOf("2"), { doc: "n2", device: "laptop" });

    const client = createDriveClient(async () => "tok", api.fetch);
    const remote = client.driveRemote(root, "laptop");

    await remote.organize();

    expect(api.files.get(f1)!.parents).toEqual([pagesOlder]);
    expect(api.files.get(f2)!.parents).toEqual([pagesOlder]);
  });

  it("reads organized and legacy files on initial scan, incremental changes, and folderHasDocs", async () => {
    const api = new FakeGoogleDrive();
    const root = api.seedFolder("Notemax");
    const otherRoot = api.seedFolder("Unrelated");
    const wsRoot = api.seedFolder("workspaces", root);
    const main = api.seedFolder("main", wsRoot);
    const pages = api.seedFolder("pages", main);

    api.seedFile("notemax-key.json", [root], bytesOf("{}"), undefined, "application/json");
    api.seedFile("old-note@phone", [root], bytesOf("old"), { doc: "old-note", device: "phone" });
    api.seedFile("sub-note@phone", [pages], bytesOf("sub"), { doc: "sub-note", device: "phone" });
    api.seedFile("other@phone", [otherRoot], bytesOf("ignored"), { doc: "other", device: "phone" });

    const client = createDriveClient(async () => "tok", api.fetch);
    expect(await client.folderHasDocs(root, "phone")).toBe(false);
    expect(await client.folderHasDocs(root, "laptop")).toBe(true);

    const laptop = client.driveRemote(root, "laptop");
    const first = await laptop.changes(null);
    expect(first.entries.map((e) => e.docId).sort()).toEqual(["old-note", "sub-note"]);

    // Normal poll with no changes does just 1 GET /changes request.
    api.requests.length = 0;
    const empty = await laptop.changes(first.cursor);
    expect(empty.entries).toEqual([]);
    expect(api.requests).toHaveLength(1);

    // Phone creates a brand-new workspace folder and writes a note inside it.
    const phone = client.driveRemote(root, "phone");
    await phone.write("ws:newspace:p1", bytesOf("hello new workspace"));

    const next = await laptop.changes(empty.cursor);
    expect(next.entries.map((e) => e.docId)).toEqual(["ws:newspace:p1"]);
    expect(textOf(await laptop.read(next.entries[0].ref))).toBe("hello new workspace");

    // Subsequent poll for an edit in that new workspace needs no folder refresh.
    await phone.write("ws:newspace:p1", bytesOf("updated"));
    api.requests.length = 0;
    const afterEdit = await laptop.changes(next.cursor);
    expect(afterEdit.entries.map((e) => e.docId)).toEqual(["ws:newspace:p1"]);
    expect(api.requests.filter((r) => r.path === "/drive/v3/files")).toHaveLength(0);
  });

  it("recovers from 401 token expiry and 404 deleted subfolders", async () => {
    const api = new FakeGoogleDrive();
    let refreshed = 0;
    const client = createDriveClient(async (force) => {
      if (force) refreshed++;
      return "tok";
    }, api.fetch);

    api.failNext401 = true;
    const root = (await client.findFolder(true))!;
    expect(refreshed).toBe(1);

    const remote = client.driveRemote(root, "laptop");
    await remote.write("note-1", bytesOf("v1"));

    // Simulate user deleting the "pages" subfolder in Drive, then device writing another note.
    const pagesFolder = [...api.files.values()].find((f) => f.mimeType === FOLDER_TYPE && f.name === "pages")!;
    api.files.delete(pagesFolder.id);
    await remote.write("note-2", bytesOf("v2"));
    const note2 = [...api.files.values()].find((f) => f.appProperties?.doc === "note-2")!;
    expect(api.pathOf(note2.id, root)).toBe("workspaces/main/pages/note-2@laptop");
  });

  it("syncs end-to-end with createSyncEngine before, during, and after organizing older files", async () => {
    const api = new FakeGoogleDrive();
    const root = api.seedFolder("Notemax");
    const { key, check } = await newKey("correct horse", ROUNDS);
    const client = createDriveClient(async () => "tok", api.fetch);
    await client.writeKeyCheck(root, check);

    // Seed a legacy flat file written before folder organization existed.
    const legacyDoc = new Y.Doc();
    legacyDoc.getText("body").insert(0, "Legacy note. ");
    const { seal } = await import("../src");
    api.seedFile("legacy-1@tablet", [root], await seal(key, Y.encodeStateAsUpdate(legacyDoc)), {
      doc: "legacy-1",
      device: "tablet",
    });

    const makeDevice = async (name: string) => {
      const store = createMemoryStore();
      let state: SyncState = { cursor: null, dirty: [] };
      const remote = client.driveRemote(root, name);
      const engine = createSyncEngine({
        store,
        remote,
        key,
        device: name,
        loadState: () => state,
        saveState: (next) => (state = next),
        onRemoteUpdate: () => {},
      });
      return { store, remote, engine };
    };

    const laptop = await makeDevice("laptop");
    await laptop.engine.sync();

    // Organize legacy files while laptop is active and writes another edit.
    await laptop.remote.organize();
    const local = await openLocalDoc(laptop.store, "legacy-1", { batchMs: 0 });
    local.doc.getText("body").insert(local.doc.getText("body").length, "Edited on laptop.");
    await local.close();
    laptop.engine.markDirty("legacy-1");
    await laptop.engine.sync();

    // A brand-new phone adopts everything from the organized Drive folder.
    expect(await client.folderHasDocs(root, "phone")).toBe(true);
    const phone = await makeDevice("phone");
    await phone.engine.sync();

    const onPhone = await openLocalDoc(phone.store, "legacy-1");
    expect(onPhone.doc.getText("body").toString()).toBe("Legacy note. Edited on laptop.");
    await onPhone.close();

    // Confirm no files other than notemax-key.json remain directly in Notemax/.
    const rootFiles = [...api.files.values()].filter((f) => f.mimeType !== FOLDER_TYPE && f.parents.includes(root));
    expect(rootFiles.map((f) => f.name)).toEqual(["notemax-key.json"]);
  });
});
