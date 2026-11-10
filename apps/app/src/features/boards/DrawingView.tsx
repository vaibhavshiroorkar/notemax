import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { Icon } from "@/ui/Icon";
import { useShownTheme } from "@/ui/appearance";
import type { StoredFile } from "./board-sync";
import { DEFAULT_HEIGHT, HEIGHTS, hasShapes, packScene, readFiles, readList, shouldOpenNew } from "./drawing-data";
import type { Scene } from "./DrawingCanvas";
import "./drawing.css";
import { PaneLoading } from "@/ui/Spinner";

const DrawingCanvas = lazy(() => import("./DrawingCanvas"));

/**
 * A drawing in a note. It shows as a picture, so a note full of drawings stays
 * light and scrolls like text; clicking it opens Excalidraw in its place.
 */
export function DrawingView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { elements, files, height } = node.attrs as { elements: string; files: string; height: number | null };
  const editable = editor.isEditable;
  const theme = useShownTheme();
  const [editing, setEditing] = useState(() => editable && shouldOpenNew() && !hasShapes(readList(elements)));
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const close = () => {
    setEditing(false);
    setFull(false);
  };

  useEffect(() => {
    if (!editable) close();
  }, [editable]);

  // A click anywhere else in the app puts the drawing down. Excalidraw's own
  // popups (colors, fonts, dialogs) may sit outside the block, so they do not count.
  useEffect(() => {
    if (!editing) return;
    let onCanvas = false;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      onCanvas = !!target?.closest(".drawing-live") && !!box.current?.contains(target);
      if (!target || box.current?.contains(target) || target.closest(".excalidraw, [data-radix-popper-content-wrapper]")) return;
      close();
    };
    // The editor makes a selected block draggable, so the browser would start
    // dragging it a few pixels into every stroke and cut the stroke short.
    const onDrag = (event: DragEvent) => {
      if (onCanvas) event.preventDefault();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("dragstart", onDrag, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("dragstart", onDrag, true);
    };
  }, [editing]);

  const save = (scene: Scene) => {
    const packed = packScene(scene.elements, scene.files);
    // The note may be gone or closing by the time the last strokes save.
    if (!editor.isDestroyed && (packed.elements !== elements || packed.files !== files)) updateAttributes(packed);
    return packed.elements;
  };

  const shown = height ?? DEFAULT_HEIGHT;
  return (
    <NodeViewWrapper ref={box} className="drawing-block" data-selected={selected || undefined} data-editing={editing || undefined} data-full={full || undefined}>
      <div className="drawing-head" data-drag-handle contentEditable={false}>
        <span className="drawing-name">
          <Icon name="board" /> Drawing
        </span>
        {editable && (
          <span className="drawing-actions" onMouseDown={(event) => event.preventDefault()}>
            {!full &&
              Object.entries(HEIGHTS).map(([label, size]) => (
                <button key={label} className="image-bar-button" aria-pressed={shown === size} title={`${size} pixels tall`} onClick={() => updateAttributes({ height: size === DEFAULT_HEIGHT ? null : size })}>
                  {label}
                </button>
              ))}
            <button
              className="image-bar-button"
              title={full ? "Back into the note" : "Draw on the whole window"}
              onClick={() => {
                setFull(!full);
                setEditing(true);
              }}
            >
              <Icon name="expand" /> {full ? "Exit full screen" : "Full screen"}
            </button>
            {editing ? (
              <button className="image-bar-button drawing-done" onClick={close}>
                Done
              </button>
            ) : (
              <button className="image-bar-button" onClick={() => setEditing(true)}>
                <Icon name="pencil" /> Draw
              </button>
            )}
          </span>
        )}
      </div>
      <div className="drawing-frame" style={full ? undefined : { height: shown }} contentEditable={false}>
        {editing ? (
          <div className="drawing-live">
            <Suspense fallback={<PaneLoading label="Opening the drawing" />}>
              <DrawingCanvas elements={elements} files={files} theme={theme} onSave={save} />
            </Suspense>
          </div>
        ) : (
          <Preview elements={elements} files={files} dark={theme === "dark"} editable={editable} onOpen={() => setEditing(true)} />
        )}
      </div>
    </NodeViewWrapper>
  );
}

function Preview({ elements, files, dark, editable, onOpen }: { elements: string; files: string; dark: boolean; editable: boolean; onOpen(): void }) {
  const svgBox = useRef<HTMLDivElement>(null);
  const list = useMemo(() => readList(elements), [elements]);
  const empty = !hasShapes(list);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const target = svgBox.current;
    if (!target) return;
    if (empty) {
      target.replaceChildren();
      return;
    }
    let cancelled = false;
    import("./drawing-preview")
      .then((module) => module.drawingSvg(list, readFiles(files) as Record<string, StoredFile>, dark))
      .then(
        (svg) => {
          if (cancelled) return;
          setFailed(false);
          target.replaceChildren(svg);
        },
        () => !cancelled && setFailed(true),
      );
    return () => {
      cancelled = true;
    };
  }, [list, files, dark, empty]);

  return (
    <div className="drawing-preview" data-editable={editable || undefined} onClick={editable ? onOpen : undefined}>
      <div className="drawing-svg" ref={svgBox} />
      {empty && <p className="drawing-note">{editable ? "Click to draw" : "An empty drawing"}</p>}
      {failed && <p className="drawing-note">Could not show this drawing.</p>}
    </div>
  );
}
