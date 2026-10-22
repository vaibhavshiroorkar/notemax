import type * as Y from "yjs";
import { useLocalDoc } from "@/data/useLocalDoc";
import type { LinkHub } from "@/features/links/link-hub";
import { useVersions } from "@/features/history/versions";
import { Editor } from "./Editor";
import { useBodyIndex } from "./useBodyIndex";

/** Another note's text, edited inside the open page, like a subtopic shown in its chapter. */
export function InlineNote({ id, hub, workspaceDoc, placeholder = "Write here..." }: { id: string; hub: LinkHub; workspaceDoc: Y.Doc; placeholder?: string }) {
  const { local, openError } = useLocalDoc(id);
  // Its words, links and versions are kept up as if it were open on its own.
  useBodyIndex(local?.doc, workspaceDoc, id);
  useVersions(local?.doc, id);
  if (openError) return <p className="error">Could not open this part: {openError}</p>;
  if (!local) return <div className="inline-note-loading" aria-busy="true" />;
  return <Editor doc={local.doc} noteId={id} hub={hub} placeholder={placeholder} />;
}
