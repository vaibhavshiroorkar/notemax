import { generateJSON, getSchema, type AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import type { LinkHub } from "@/features/links/link-hub";
import { registry } from "@/plugins/registry";

// What a note's body can hold, without an editor on screen: for turning a
// Markdown file into a note, for instance. It must match the editor's own list.

// Only node views use the hub, and nothing is drawn here.
const NO_HUB = undefined as unknown as LinkHub;

export const bodyExtensions = (): AnyExtension[] => [StarterKit.configure({ undoRedo: false }), ...registry.contentExtensions({ noteId: "", hub: NO_HUB })];

export const bodySchema = () => getSchema(bodyExtensions());

/** HTML as a note body, the way pasting it would read it. */
export const htmlToBody = (html: string) => generateJSON(html, bodyExtensions());
