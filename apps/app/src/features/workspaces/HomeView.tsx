import { useEffect, useState, type DragEvent } from "react";
import type { WorkspaceInfo } from "@notemax/core";
import { MAIN_WORKSPACE } from "@notemax/core";
import { recentPages } from "@/data/recent";
import { currentWorkspace } from "@/platform/prefs";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { ConfirmDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { askText } from "@/ui/Prompt";
import { WORKSPACE_COLORS, createWorkspace, deleteWorkspace, move, nameOf, openList, pageCount, recolor, rename, switchTo, workspaceList } from "./list";
import { Dot } from "./Switcher";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Card({ workspace, app, count, onDragTo }: { workspace: WorkspaceInfo; app: AppContext; count: number | null; onDragTo(id: string): void }) {
  const here = workspace.id === currentWorkspace;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const name = nameOf(workspace);

  return (
    <li
      className="workspace-card"
      data-here={here || undefined}
      data-drop={dropping || undefined}
      style={workspace.color ? { borderTopColor: workspace.color } : undefined}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-notemax-workspace", workspace.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event: DragEvent) => {
        if (!event.dataTransfer.types.includes("application/x-notemax-workspace")) return;
        event.preventDefault();
        setDropping(true);
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDropping(false);
        onDragTo(event.dataTransfer.getData("application/x-notemax-workspace"));
      }}
    >
      <button className="workspace-open" aria-label={here ? `${name}, open now` : `Open ${name}`} onClick={() => (here ? app.newTab() : switchTo(workspace.id))}>
        <span className="workspace-card-title">
          <Dot color={workspace.color} />
          <strong>{name}</strong>
        </span>
        <span className="workspace-card-meta">
          {count === null ? "" : plural(count, "page")}
          {here && " - open now"}
        </span>
      </button>
      <div className="workspace-card-actions">
        <button className="link-button" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className="workspace-edit">
          <button
            className="button"
            onClick={async () => {
              const next = await askText({ title: "Rename workspace", label: "Name", value: workspace.name || name, confirm: "Rename" });
              if (next?.trim()) void rename(workspace.id, next.trim());
            }}
          >
            <Icon name="pencil" />
            Rename
          </button>
          <div className="format-swatches" role="group" aria-label={`Color of ${name}`}>
            {WORKSPACE_COLORS.map((color) => (
              <button
                key={color || "none"}
                className="format-swatch"
                aria-label={color ? `Color ${color}` : "No color"}
                aria-pressed={workspace.color === color}
                data-none={!color || undefined}
                style={color ? { background: color } : undefined}
                onClick={() => void recolor(workspace.id, color)}
              />
            ))}
          </div>
          {workspace.id !== MAIN_WORKSPACE && !here && (
            <button className="link-button danger" onClick={() => setDeleting(true)}>
              Delete workspace
            </button>
          )}
        </div>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this workspace?"
          message={
            <>
              <strong>{name}</strong> and its {count === null ? "pages" : plural(count, "page")} will be erased from this device and, through sync, from your other devices. This cannot be undone.
            </>
          }
          confirmLabel="Delete workspace"
          onConfirm={() => {
            setDeleting(false);
            void deleteWorkspace(workspace.id).then(() => app.notify(`Deleted "${name}"`));
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </li>
  );
}

/** Home: every workspace as a card to open, rename, color, delete or drag into order, and what was open last here. */
export function HomeView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const list = workspaceList.use();
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => void openList(), []);
  useEffect(() => {
    let live = true;
    for (const workspace of list) {
      if (workspace.id === currentWorkspace) continue;
      pageCount(workspace.id)
        .then((count) => live && setCounts((all) => ({ ...all, [workspace.id]: count })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [list]);

  const recent = recentPages
    .use()
    .map((id) => app.tree.items.get(id))
    .filter((item) => item && item.kind !== "folder")
    .slice(0, 6);
  const here = list.find((w) => w.id === currentWorkspace);

  const startNew = async () => {
    const name = await askText({ title: "New workspace", label: "Name", placeholder: "Like Work, School or Novel", confirm: "Create" });
    if (name?.trim()) {
      await createWorkspace(name.trim(), WORKSPACE_COLORS[(list.length % (WORKSPACE_COLORS.length - 1)) + 1]);
      app.notify(`Made "${name.trim()}". Open it from its card.`);
    }
  };

  return (
    <div className="home-page">
      <h1>Home</h1>
      <p className="home-intro">Each workspace keeps its own pages, tabs and trash. Drag the cards to arrange them.</p>
      <ul className="workspace-grid" aria-label="Workspaces">
        {list.map((workspace) => (
          <Card
            key={workspace.id}
            workspace={workspace}
            app={app}
            count={workspace.id === currentWorkspace ? app.tree.visible.size : (counts[workspace.id] ?? null)}
            onDragTo={(dragged) => dragged && dragged !== workspace.id && void move(dragged, list.findIndex((w) => w.id === workspace.id))}
          />
        ))}
        <li className="workspace-card workspace-new">
          <button className="workspace-open" onClick={() => void startNew()}>
            <span className="workspace-card-title">
              <Icon name="plus" />
              <strong>New workspace</strong>
            </span>
            <span className="workspace-card-meta">For work, school, a novel...</span>
          </button>
        </li>
      </ul>

      {recent.length > 0 && (
        <>
          <h2 className="home-heading">Recent in {here ? nameOf(here) : "this workspace"}</h2>
          <ul className="new-tab-list">
            {recent.map((item) => (
              <li key={item!.id}>
                <button className="row-title icon-title" onClick={() => app.open(item!.id)}>
                  <Icon name={item!.kind === "note" ? "note" : registry.iconOf(item!.kind)} />
                  <span>{item!.title || "Untitled"}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
