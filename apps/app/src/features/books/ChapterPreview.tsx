import { useEffect, useState } from "react";
import { openLocalDoc, plainText, type TreeItem } from "@notemax/core";
import { peekDoc } from "@/data/docCache";
import { useHidden } from "@/features/lock/LockedInline";
import { storeFor } from "@/platform/platform";

// The first lines of a chapter, for the book page's Previews. Read once per
// edit time, so going back to the book page does not read every chapter again.

const LENGTH = 280;
const cache = new Map<string, { edited: number; text: string }>();

async function readStart(id: string, workspace: string): Promise<string> {
  // An open chapter gives its last keystrokes too.
  await peekDoc(id, workspace)?.flush();
  const local = await openLocalDoc(await storeFor(workspace), id, {});
  try {
    const text = plainText(local.doc.getXmlFragment("content")).replace(/\s+/g, " ").trim();
    return text.length > LENGTH ? `${text.slice(0, LENGTH).replace(/\s+\S*$/, "")}...` : text;
  } finally {
    await local.close();
  }
}

export function ChapterPreview({ item, workspace }: { item: TreeItem; workspace: string }) {
  const key = `${workspace}:${item.id}`;
  const known = cache.get(key);
  const hidden = useHidden(item);
  const [text, setText] = useState(known?.edited === item.editedAt ? known.text : null);
  useEffect(() => {
    const saved = cache.get(key);
    if (saved?.edited === item.editedAt) return setText(saved.text);
    let live = true;
    readStart(item.id, workspace).then(
      (start) => {
        cache.set(key, { edited: item.editedAt, text: start });
        if (live) setText(start);
      },
      () => live && setText(""),
    );
    return () => {
      live = false;
    };
  }, [key, item.id, item.editedAt, workspace]);
  if (hidden) return <p className="chapter-preview">Locked.</p>;
  if (text === null) return <p className="chapter-preview" aria-busy="true" />;
  return <p className="chapter-preview">{text || <em>Nothing written yet.</em>}</p>;
}
