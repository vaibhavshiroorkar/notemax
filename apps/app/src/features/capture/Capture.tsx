import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { captureNote } from "@notemax/core";
import { docChannelFor, getStore, isDesktop } from "@/platform/platform";
import { workspaceNow } from "@/platform/prefs";
import { getPref, setPref } from "@/platform/prefs";

const DRAFT_KEY = "captureDraft";

async function hideWindow() {
  if (!isDesktop) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

/** The quick capture box. Enter saves it as a new note and hides the window. */
export function Capture() {
  const [text, setText] = useState(() => getPref(DRAFT_KEY) ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // The window is hidden, not closed, between uses. Focus the box each time it comes back.
    const focusBox = () => box.current?.focus();
    // Clicking another app puts the box away. The draft stays for next time.
    const onBlur = () => void hideWindow();
    window.addEventListener("focus", focusBox);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("focus", focusBox);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const edit = (value: string) => {
    setText(value);
    // Kept per keystroke, so text typed but not yet saved survives a quit.
    setPref(DRAFT_KEY, value);
  };

  const save = async () => {
    if (saving) return;
    if (!text.trim()) return hideWindow();
    setSaving(true);
    try {
      await captureNote(await getStore(), text, { broadcast: docChannelFor(workspaceNow()) });
      edit("");
      setError(undefined);
      await hideWindow();
    } catch (err) {
      // Keep the window open with the text in it, so nothing is lost.
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter while an input method is composing picks a word; it must not save.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      void hideWindow();
    }
  };

  return (
    <main className="capture">
      <header className="capture-header" data-tauri-drag-region>
        Quick capture
      </header>
      <textarea
        ref={box}
        className="capture-box"
        aria-label="Quick note"
        placeholder="Type a note. The first line is its title. Start a line with [ ] to add a to-do to your Inbox."
        value={text}
        autoFocus
        onChange={(event) => edit(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <footer className={error ? "capture-footer capture-error" : "capture-footer"} role="status">
        {error ? `Not saved: ${error}` : saving ? "Saving..." : "Enter saves. Shift+Enter adds a line. Esc closes."}
      </footer>
    </main>
  );
}
