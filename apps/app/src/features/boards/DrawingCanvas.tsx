import "./excalidrawAssets";
import { useEffect, useMemo, useRef } from "react";
import { CaptureUpdateAction, Excalidraw, MainMenu, getSceneVersion, reconcileElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { StoredElement, StoredFile } from "./board-sync";
import { readFiles, readList } from "./drawing-data";

// Loaded only when someone draws in a note, because Excalidraw is large.

type Api = Parameters<NonNullable<Parameters<typeof Excalidraw>[0]["excalidrawAPI"]>>[0];
type Elements = Parameters<typeof reconcileElements>[0];
type RemoteElements = Parameters<typeof reconcileElements>[1];

export interface Scene {
  elements: readonly StoredElement[];
  files: Record<string, StoredFile>;
}

/** How long drawing pauses before the note saves it. Each save rewrites the whole drawing. */
const SAVE_AFTER_MS = 400;

export default function DrawingCanvas({
  elements,
  files,
  theme,
  onSave,
}: {
  /** The stored scene, as the block's attributes hold it. */
  elements: string;
  files: string;
  theme: "light" | "dark";
  /** Stores the scene and says the elements text it stored. */
  onSave(scene: Scene): string;
}) {
  const api = useRef<Api | null>(null);
  // The elements text this canvas last stored or took in. A different one
  // arriving is an edit from another device or window.
  const known = useRef(elements);
  const unsaved = useRef<Scene | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const save = useRef(onSave);
  save.current = onSave;

  // Read once: after this the canvas holds the scene and merges what comes in.
  const initialData = useMemo(
    () => ({
      elements: readList(elements) as unknown as Elements,
      files: readFiles(files) as never,
      // The page shows through, so the drawing looks the same open or shut.
      appState: { viewBackgroundColor: "transparent" },
      scrollToContent: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // onChange fires on every pointer move; the version only moves when a shape does.
  const savedVersion = useRef(getSceneVersion(initialData.elements));
  const fileCount = useRef(Object.keys(initialData.files).length);

  const flush = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const scene = unsaved.current;
    unsaved.current = null;
    if (scene) known.current = save.current(scene);
  };
  const later = (scene: Scene) => {
    unsaved.current = scene;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_AFTER_MS);
  };

  // Closing the drawing keeps the last strokes.
  useEffect(() => flush, []);

  // Another device drew too: merge the way boards do, so a shape being moved
  // here stays put, then store the merge if it holds shapes the other side lacks.
  useEffect(() => {
    const board = api.current;
    if (!board || elements === known.current) return;
    known.current = elements;
    const remote = readList(elements);
    const merged = reconcileElements(board.getSceneElementsIncludingDeleted() as Elements, remote as unknown as RemoteElements, board.getAppState());
    savedVersion.current = getSceneVersion(merged);
    board.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
    const have = board.getFiles();
    const missing = Object.values(readFiles(files)).filter((file) => !(file.id in have));
    if (missing.length) board.addFiles(missing as never);
    if (unsaved.current || getSceneVersion(merged) !== getSceneVersion(remote as never)) later({ elements: merged as unknown as StoredElement[], files: board.getFiles() as never });
  }, [elements, files]);

  return (
    <Excalidraw
      excalidrawAPI={(board) => {
        api.current = board;
      }}
      initialData={initialData}
      theme={theme}
      autoFocus
      onChange={(next, _appState, nextFiles) => {
        const version = getSceneVersion(next);
        const count = Object.keys(nextFiles).length;
        if (version === savedVersion.current && count === fileCount.current) return;
        savedVersion.current = version;
        fileCount.current = count;
        later({ elements: next as unknown as StoredElement[], files: nextFiles as unknown as Record<string, StoredFile> });
      }}
      UIOptions={{
        canvasActions: {
          // The note saves the drawing, and the theme follows the app's.
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: null,
          export: false,
        },
      }}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
      </MainMenu>
    </Excalidraw>
  );
}
