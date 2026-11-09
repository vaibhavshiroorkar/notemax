# Data and sync

How Notemax keeps pages, moves them between devices, and keeps them safe.

## Pages are Yjs documents

Every page body is a [Yjs](https://yjs.dev) document. Yjs is a CRDT: two copies edited apart merge into one without losing either side's text. That one property is what makes offline editing and sync safe.

- Each document is saved as an **append-only log** of updates, compacted now and then (`packages/core/src/local-doc.ts`).
- The **workspace tree** (titles, kinds, parents, order, tags, settings per page) is one more Yjs document. Moves made on two devices merge field by field.
- Order uses **fractional positions**, so moving a page changes only that page.
- Links are stored by page id, so renaming never breaks them. Backlinks are read from the tree.

## Where pages live

Both stores sit behind one `DocStore` interface (`packages/core/src/store.ts`), so the rest of the app does not care which it gets.

| Where | Store |
| --- | --- |
| Browser | IndexedDB, with strict durability (`idb-store.ts`) |
| Desktop | One SQLite file in WAL mode, `notemax.db` in the app's data folder (`sql-store.ts`) |

On the web a device can also keep **no pages at all** (Settings, Setup): edits go to Drive at once and the browser keeps only what is open.

## Workspaces

Each workspace has its own tree and pages. The first workspace keeps plain ids; the others prefix theirs with `ws:<id>:`, so one store holds them all (`packages/core/src/workspaces.ts`). The list of workspaces is a document of its own, outside every workspace, so it syncs too. A workspace can carry a `locked` mark; the app then hides its list and pages until the lock password is typed.

## Sync through Google Drive

Sync is optional. It goes through a `Notemax` folder in the person's own Google Drive, using the `drive.file` scope, so the app sees only files it made.

- **One file per page per device.** Each device writes only its own files, named `<docId>@<device>`, and reads the others'. No device overwrites another's file, so two devices editing the same note offline both keep their text.
- **End-to-end encrypted.** Files are sealed with a key from the person's passphrase. Google stores only ciphertext. A check file in the folder tells a wrong passphrase apart.
- **The engine** is `packages/core/src/sync.ts`. A sync run reads what changed in Drive (the Changes API, one request when nothing changed) and sends this device's edited pages at the same time, so a slow read never holds an edit back. Up to ten requests are in flight at once. A device starting from nothing reads first, so it never sends an empty page over its own file.
- **Timing** (`apps/app/src/features/sync/runtime.ts`): an edit goes to Drive 0.6 seconds after a burst of typing, or 1.5 seconds while live updates are on, since those already carried it. While the window is on screen, it checks for other devices' edits every 5 seconds (10 with live updates on), and again on focus, on coming back online and when the window shows. A hidden window sends waiting edits at once. The short-lived Drive token is kept on the device, so a restart within the hour goes straight to Drive.
- **Live updates.** While two devices are open, each edit also goes straight to the others through a Supabase Realtime channel, sealed with the same key. Drive stays the record. An edit the channel could not carry, like one too big for it, goes through Drive, and the other devices get a nudge to read it at once instead of at their next check.
- **Catching up.** At start the app syncs at once, then looks for pages it may never have sent (for example after a forced close) and sends those too.
- **Conflicts.** When a page edited here and not yet sent was also edited elsewhere, both edits merge and the app asks which side to keep, with the two versions compared in color.

An optional **Markdown mirror** keeps every note as a plain `.md` file in a chosen folder, in step both ways.

## Accounts

Accounts use Supabase, with Google sign-in. They are optional and found only in Settings. Google's refresh token stays on the device; a small Supabase function trades it for short-lived Drive tokens, so the Google client secret is never on a device.

Supabase also holds what is meant to be shared: shared pages, community posts, profiles, messages and reader notes, each guarded by row-level security. Private pages never go there.

## Versions and activity

- Each note keeps versions: how it was before editing began, one every few minutes of editing, and how it was left. Old versions thin out over time (`packages/core/src/history.ts`).
- Each version records whose edits it holds. An Activity log keeps the last 500 things done to a page: edits, renames, moves, trash, restores, conflicts, shares and locks (`packages/core/src/audit.ts`).
- Versions and activity live in a history document per page, and sync like any other.

## Locks

The page lock and the workspace lock share one password. Only a check of it is stored, made the same way as the sync passphrase check, and it follows the person to every device with their settings. The text stays on disk as it was: the lock keeps out casual eyes, it is not encryption. After five minutes with no key or pointer, locked pages and workspaces close again.

## Temporary pages

In a browser that does not sync, pages live only in that browser, which may clear its storage. The sidebar says so in a notice. Once sync is on, pages made before carry a mark until you keep them.
