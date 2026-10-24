import { useEffect, useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { usePageWorkspace } from "@/data/scope";
// Any asset reads the same way; pictures were simply first.
import { imageUrl } from "@/features/images/store";
import "./video.css";

const SIZES = [25, 50, 75, 100];

/** A video in a note, played in place. Its top line drags it; selected, a bar sets its width. */
export function VideoView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { asset, name, width } = node.attrs as { asset: string | null; name: string; width: number | null };
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const workspace = usePageWorkspace();

  useEffect(() => {
    let cancelled = false;
    if (asset)
      imageUrl(asset, workspace).then(
        (found) => {
          if (cancelled) return;
          setUrl(found);
          setMissing(!found);
        },
        () => !cancelled && setMissing(true),
      );
    return () => {
      cancelled = true;
    };
  }, [asset, workspace]);

  return (
    <NodeViewWrapper className="video-block" data-selected={selected || undefined} style={width ? { width: `${width}%` } : undefined}>
      <div className="video-name" data-drag-handle contentEditable={false}>
        {name || "Video"}
      </div>
      {url ? (
        <video src={url} controls preload="metadata" />
      ) : (
        <div className="video-missing">{missing ? "This video is not on this device." : "Loading video..."}</div>
      )}
      {selected && editor.isEditable && (
        <div className="image-bar video-bar" contentEditable={false} onMouseDown={(event) => event.preventDefault()}>
          {SIZES.map((size) => (
            <button key={size} className="image-bar-button" aria-pressed={(width ?? 100) === size} title={`${size}% wide`} onClick={() => updateAttributes({ width: size === 100 ? null : size })}>
              {size === 100 ? "Full" : `${size}%`}
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}
