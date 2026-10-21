import { useCallback, useEffect, useRef } from "react";
import { TextSelection } from "@tiptap/pm/state";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { getPosition, setPosition } from "@/data/positions";

/**
 * Brings a note back to where it was left: the same scroll and the same cursor.
 * Call the returned function once the editor shows the note. It returns true
 * when there was a place to go back to.
 */
export function useRememberPosition(noteId: string) {
  const stopWatching = useRef<() => void>(undefined);
  useEffect(() => () => stopWatching.current?.(), []);

  return useCallback(
    (editor: TiptapEditor, scroller: HTMLElement | null): boolean => {
      // The editor can be made twice for one page (React does so on purpose in
      // development). A watcher left from the first would save this page's
      // scroll under the next note's name.
      stopWatching.current?.();
      const saved = getPosition(noteId);
      if (saved) {
        // This runs inside a React effect. A transaction there makes node views
        // drawn by React (like link chips) redraw at a moment React refuses, so
        // the cursor moves just after, before the next frame is painted.
        queueMicrotask(() => {
          if (editor.isDestroyed) return;
          const { doc } = editor.state;
          const at = (pos: number) => doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
          // The note may have changed on another device; `between` finds the nearest valid spot.
          editor.view.dispatch(editor.state.tr.setSelection(TextSelection.between(at(saved.from), at(saved.to))));
        });
      }
      const top = saved?.top ?? 0;
      if (scroller) scroller.scrollTop = top;

      const onScroll = () => setPosition(noteId, { top: scroller!.scrollTop });
      const onSelection = () => setPosition(noteId, { from: editor.state.selection.from, to: editor.state.selection.to });
      editor.on("selectionUpdate", onSelection);
      // A note that was already open in memory gets its text drawn a tick after
      // the editor appears, so the page may still be too short to scroll. Try
      // again once it is drawn. Watching the scroll starts only then, so the
      // short moment is never saved as this note's place.
      let frame = 0;
      const timer = setTimeout(() => {
        frame = requestAnimationFrame(() => {
          if (!scroller) return;
          scroller.scrollTop = top;
          scroller.addEventListener("scroll", onScroll, { passive: true });
        });
      });
      stopWatching.current = () => {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        scroller?.removeEventListener("scroll", onScroll);
        editor.off("selectionUpdate", onSelection);
      };
      return !!saved;
    },
    [noteId],
  );
}
