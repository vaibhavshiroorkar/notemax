import { Suspense, lazy, useEffect } from "react";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { locksVersion, registry } from "@/plugins/registry";
import { useShownTheme } from "@/ui/appearance";
import "./boards.css";
import { PaneLoading } from "@/ui/Spinner";

// Excalidraw is large, so it downloads the first time a board opens, not at startup.
const BoardCanvas = lazy(() => import("./BoardCanvas"));

export function BoardPane({ node, app, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const theme = useShownTheme();
  locksVersion.use();
  const locked = !!registry.lockOf(node, app.workspace);
  useEffect(() => onStatus(status), [status, onStatus]);

  if (openError) return <p className="error">Could not open this board: {openError}</p>;

  // Excalidraw's own controls never fade, unlike the app's: on a board they are the tools in hand.
  return (
    <div className="board">
      <header className="board-header">
        <input
          className="board-title"
          value={node.title}
          placeholder="Untitled board"
          aria-label="Board title"
          autoFocus={node.title === ""}
          readOnly={locked}
          onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
        />
        <PageHeader node={node} app={app} />
      </header>
      <div className="board-canvas">
        {local ? (
          <Suspense fallback={<PaneLoading label="Opening the board" />}>
            <BoardCanvas key={node.id} doc={local.doc} theme={theme} viewOnly={locked} onReady={onReady} onEdit={() => touchNode(workspaceDoc, node.id)} />
          </Suspense>
        ) : (
          <PaneLoading label="Opening the board" />
        )}
      </div>
    </div>
  );
}
