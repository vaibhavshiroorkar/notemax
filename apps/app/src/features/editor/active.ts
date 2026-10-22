import type { Editor } from "@tiptap/react";
import { createStore } from "@/platform/store";

/** The note editor on screen, for panels outside the note that act on it, like Format. */
export const activeEditor = createStore<Editor | null>(null);
