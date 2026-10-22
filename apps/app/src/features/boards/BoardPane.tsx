import { Suspense, lazy, useEffect } from "react";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import { useOption } from "@/plugins/options";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { useShownTheme } from "@/ui/appearance";
import "./boards.css";

// Excalidraw is large, so it downloads the first time a board opens, not at startup.
const BoardCanvas = lazy(() => import("./BoardCanvas"));

export function BoardPane({ node, app, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const theme = useShownTheme();
  const calm = useOption("appearance", "fadeControls");
  useEffect(() => onStatus(status), [status, onStatus]);

  if (openError) return <p className="error">Could not open this board: {openError}</p>;

  return (
    <div className="board" data-calm={calm || undefined}>
      <header className="board-header">
        <input
          className="board-title"
          value={node.title}
          placeholder="Untitled board"
          aria-label="Board title"
          autoFocus={node.title === ""}
          onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <PageHeader node={node} app={app} />
      </header>
      <div className="board-canvas">
        {local && (
          <Suspense fallback={<p className="board-loading">Opening the board...</p>}>
            <BoardCanvas key={node.id} doc={local.doc} theme={theme} onReady={onReady} onEdit={() => touchNode(workspaceDoc, node.id)} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
