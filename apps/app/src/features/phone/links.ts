import { ROOT, sharedNote, writeNoteBody } from "@notemax/core";
import { addPage } from "@/data/addPage";
import { docChannelFor, storeFor } from "@/platform/platform";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";

/**
 * Links the Android app opens itself with. MainActivity turns text shared
 * from another app into a share link, and the launcher's long-press
 * shortcuts (res/xml/shortcuts.xml) open the others. Any app can open these
 * links, so each one does a fixed, harmless thing: none runs an arbitrary
 * command or reads a page.
 */
export const PHONE_LINK = "notemax://open/";

/** Palette commands the shortcuts open. A plugin that is off has none, and its shortcut does nothing. */
const COMMANDS: Record<string, string> = { today: "dates.today", tasks: "tasks.open" };

export async function openPhoneLink(app: AppContext, link: string): Promise<void> {
  const url = new URL(link);
  const action = url.pathname.replace(/^\//, "");
  if (action === "new") return app.create("note");
  if (action === "share") return saveShared(app, url.searchParams.get("text") ?? "", url.searchParams.get("subject") ?? "");
  const command = COMMANDS[action] && registry.commands(app).find((c) => c.id === COMMANDS[action]);
  if (command) await command.run(app);
}

/** Saves what was shared as a new note and opens it. The body is written before the note is listed, as quick capture does. */
async function saveShared(app: AppContext, text: string, subject: string) {
  const note = sharedNote(text, subject);
  if (!note) return;
  const id = crypto.randomUUID();
  await writeNoteBody(await storeFor(app.workspace), id, note.body, { broadcast: docChannelFor(app.workspace) });
  addPage(app.doc, "note", ROOT, note.title, undefined, id);
  app.open(id);
  app.notify("Saved as a new note");
}
