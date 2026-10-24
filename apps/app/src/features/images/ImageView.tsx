import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { usePageWorkspace } from "@/data/scope";
import { saveImage, imageUrl } from "./store";
import "./images.css";

// Sizes a drag snaps to when it comes close, in percent of the text width.
const SNAP = [25, 33, 50, 66, 75, 100];
const MIN_PX = 48;

const ALIGNS = [
  { value: "left", label: "Left, text beside it" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right, text beside it" },
] as const;

/**
 * A picture in a note. Selected, it shows handles on both sides to drag it to
 * any width (snapping near common sizes; hold Alt for none), and a small bar
 * to place it. Its menu (right click) has the rest.
 */
export function ImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { asset, src, alt, width, align } = node.attrs as { asset: string | null; src: string | null; alt: string; width: number | null; align: "left" | "center" | "right" };
  const [url, setUrl] = useState<string | null>(src && !src.startsWith("data:") ? src : null);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState<number | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const workspace = usePageWorkspace();

  useEffect(() => {
    let cancelled = false;
    if (asset) {
      imageUrl(asset, workspace).then(
        (found) => {
          if (cancelled) return;
          setUrl(found);
          setMissing(!found);
        },
        () => !cancelled && setMissing(true),
      );
    } else if (src?.startsWith("data:") && editor.isEditable) {
      // A picture pasted as text is kept like any other, so the note stays small.
      fetch(src)
        .then((response) => response.blob())
        .then((blob) => saveImage(blob, "picture", workspace))
        .then((id) => !cancelled && updateAttributes({ asset: id, src: null }))
        .catch(() => !cancelled && setUrl(src));
    }
    return () => {
      cancelled = true;
    };
  }, [asset, src, editor, updateAttributes, workspace]);

  const startResize = (side: "left" | "right") => (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const box = frame.current!;
    const textWidth = box.parentElement!.parentElement!.clientWidth;
    const startX = event.clientX;
    const startPx = box.getBoundingClientRect().width;
    // A centered picture grows on both sides, so the pointer moves half as far.
    const factor = (side === "left" ? -1 : 1) * (align === "center" ? 2 : 1);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    let percent = width ?? Math.round((startPx / textWidth) * 100);
    const move = (e: PointerEvent) => {
      const px = Math.min(textWidth, Math.max(MIN_PX, startPx + (e.clientX - startX) * factor));
      percent = Math.round((px / textWidth) * 100);
      if (!e.altKey) percent = SNAP.find((s) => Math.abs(s - percent) <= 2) ?? percent;
      setLive(percent);
    };
    const up = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
      setLive(null);
      updateAttributes({ width: Math.max(5, Math.min(100, percent)) });
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  const shown = live ?? width;
  return (
    <NodeViewWrapper className="image-block" data-align={align} data-selected={selected || undefined} style={shown ? { width: `${shown}%` } : undefined}>
      <div className="image-frame" ref={frame} data-drag-handle>
        {url ? (
          <img src={url} alt={alt} draggable={false} />
        ) : (
          <div className="image-missing">{missing ? "This picture is not on this device." : "Loading picture..."}</div>
        )}
        {selected && editor.isEditable && (
          <>
            <span className="image-handle" data-side="left" role="separator" aria-label="Drag to resize" onPointerDown={startResize("left")} />
            <span className="image-handle" data-side="right" role="separator" aria-label="Drag to resize" onPointerDown={startResize("right")} />
            {live !== null && <span className="image-size">{live}%</span>}
            <div className="image-bar" contentEditable={false} onMouseDown={(event) => event.preventDefault()}>
              {ALIGNS.map((a) => (
                <button key={a.value} className="image-bar-button" aria-label={a.label} title={a.label} aria-pressed={align === a.value} onClick={() => updateAttributes({ align: a.value })}>
                  <AlignIcon align={a.value} />
                </button>
              ))}
              <span className="image-bar-line" />
              {[25, 50, 100].map((size) => (
                <button key={size} className="image-bar-button" aria-pressed={width === size} title={`${size}% wide`} onClick={() => updateAttributes({ width: size })}>
                  {size === 100 ? "Full" : `${size}%`}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

function AlignIcon({ align }: { align: "left" | "center" | "right" }) {
  const box = { left: "M2 5h5v6H2z", center: "M5.5 5h5v6h-5z", right: "M9 5h5v6H9z" }[align];
  const lines = { left: "M9 5h5M9 8h5M9 11h5", center: "M2 3h12M2 13h12", right: "M2 5h5M2 8h5M2 11h5" }[align];
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d={box} />
      <path d={lines} strokeLinecap="round" />
    </svg>
  );
}
