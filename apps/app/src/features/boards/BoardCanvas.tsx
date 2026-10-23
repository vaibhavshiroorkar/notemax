import "./excalidrawAssets";
import { useEffect, useMemo, useRef } from "react";
import { CaptureUpdateAction, Excalidraw, Footer, MainMenu, getSceneVersion, reconcileElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type * as Y from "yjs";
import { BoardTools } from "./BoardTools";
import { LOCAL, elementsOf, filesOf, missingFiles, readElements, writeElements, writeFiles, type StoredElement, type StoredFile } from "./board-sync";

// This file is loaded only when a board opens, because Excalidraw is large.

type Api = Parameters<NonNullable<Parameters<typeof Excalidraw>[0]["excalidrawAPI"]>>[0];
type Elements = Parameters<typeof reconcileElements>[0];
type RemoteElements = Parameters<typeof reconcileElements>[1];

export default function BoardCanvas({ doc, theme, onReady, onEdit }: { doc: Y.Doc; theme: "light" | "dark"; onReady(): void; onEdit(): void }) {
  const api = useRef<Api | null>(null);
  // onChange fires on every pointer move. The scene version only changes when
  // an element does, so most calls end right there.
  const savedVersion = useRef(-1);

  const initialData = useMemo(
    () => ({
      elements: readElements(doc) as unknown as Elements,
      files: Object.fromEntries([...filesOf(doc).values()].map((file) => [file.id, file])) as never,
      scrollToContent: true,
    }),
    [doc],
  );

  // Changes from another window or device: merge them the way Excalidraw's own
  // collaboration does, so a shape being dragged here is not yanked away.
  useEffect(() => {
    const elements = elementsOf(doc);
    const files = filesOf(doc);
    const onElements = (_: unknown, transaction: Y.Transaction) => {
      const board = api.current;
      if (transaction.origin === LOCAL || !board) return;
      const merged = reconcileElements(board.getSceneElementsIncludingDeleted() as Elements, readElements(doc) as unknown as RemoteElements, board.getAppState());
      savedVersion.current = getSceneVersion(merged);
      board.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
    };
    const onFiles = (_: unknown, transaction: Y.Transaction) => {
      const board = api.current;
      if (transaction.origin === LOCAL || !board) return;
      const missing = missingFiles(doc, board.getFiles());
      if (missing.length) board.addFiles(missing as never);
    };
    elements.observe(onElements);
    files.observe(onFiles);
    return () => {
      elements.unobserve(onElements);
      files.unobserve(onFiles);
    };
  }, [doc]);

  return (
    <Excalidraw
      excalidrawAPI={(board) => {
        api.current = board;
        onReady();
      }}
      initialData={initialData}
      theme={theme}
      onChange={(elements, _appState, files) => {
        const version = getSceneVersion(elements);
        if (version !== savedVersion.current) {
          savedVersion.current = version;
          if (writeElements(doc, elements as unknown as StoredElement[])) onEdit();
        }
        writeFiles(doc, files as unknown as Record<string, StoredFile>);
      }}
      UIOptions={{
        canvasActions: {
          // Boards save themselves, and the theme follows the app's.
          loadScene: false,
          saveToActiveFile: false,
          toggleTheme: null,
          export: false,
        },
      }}
    >
      {/* Excalidraw's own menu also links to its website and socials; this one keeps to the board. */}
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.SearchMenu />
        <MainMenu.DefaultItems.Help />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
      </MainMenu>
      {/* Sticky notes, frames, templates and votes, in one row at the bottom. */}
      <Footer>
        <BoardTools api={() => api.current as never} />
      </Footer>
    </Excalidraw>
  );
}
