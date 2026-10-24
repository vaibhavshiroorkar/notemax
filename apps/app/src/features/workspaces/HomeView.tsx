import { useEffect, useState, type DragEvent } from "react";
import type { WorkspaceInfo } from "@notemax/core";
import { MAIN_WORKSPACE } from "@notemax/core";
import { recentPages } from "@/data/recent";
import { registry } from "@/plugins/registry";
import type { AppContext, HomeSection } from "@/plugins/types";
import { ConfirmDialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { askText } from "@/ui/Prompt";
import { Safe } from "@/ui/Safe";
import { Segmented } from "@/ui/Segmented";
import { keepFolderFor, pickFolder } from "@/features/markdown-files/mirror";
import { WORKSPACE_COLORS, createWorkspace, deleteWorkspace, move, nameOf, openList, pageCount, recolor, rename, switchTo, workspaceList } from "./list";
import { HomeList, editedAgo } from "./HomeList";
import { arranged, homeLayout, moveCard, type HomeLayout } from "./homeLayout";
import { Dot } from "./Switcher";
import { PageListView } from "./PageListView";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Card({ workspace, app, count, onDragTo, onBack }: { workspace: WorkspaceInfo; app: AppContext; count: number | null; onDragTo(id: string): void; onBack(): void }) {
  const here = workspace.id === app.workspace;
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
      <button className="workspace-open" aria-label={here ? `${name}, open now` : `Open ${name}`} onClick={() => (here ? onBack() : switchTo(workspace.id))}>
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

/** The workspaces as cards to open, rename, color, delete or drag into order. */
export function WorkspacesSection({ app }: { app: AppContext }) {
  const list = workspaceList.use();
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => void openList(), []);
  useEffect(() => {
    let live = true;
    for (const workspace of list) {
      if (workspace.id === app.workspace) continue;
      pageCount(workspace.id)
        .then((count) => live && setCounts((all) => ({ ...all, [workspace.id]: count })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [list]);
  const recent = recentPages.use();
  // The open workspace's card goes back to its last page.
  // With nothing opened yet, as in a new workspace, the first page at the top. With no pages, a new note.
  const back = () => {
    const page = recent.find((id) => app.tree.items.get(id)?.kind !== "folder" && app.tree.items.has(id)) ?? app.tree.top.find((item) => item.kind !== "folder")?.id;
    if (page) app.open(page);
    else app.create("note");
  };

  const startNew = async () => {
    const name = await askText({ title: "New workspace", label: "Name", placeholder: "Like Work, School or Novel", confirm: "Create" });
    if (name?.trim()) {
      await createWorkspace(name.trim(), WORKSPACE_COLORS[(list.length % (WORKSPACE_COLORS.length - 1)) + 1]);
      app.notify(`Made "${name.trim()}". Open it from its card.`);
    }
  };

  // A folder of Markdown files, like an Obsidian vault, becomes a workspace that stays in step with it.
  const openFolder = async () => {
    const folder = await pickFolder();
    if (!folder) return;
    const id = await createWorkspace(folder.name, WORKSPACE_COLORS[(list.length % (WORKSPACE_COLORS.length - 1)) + 1]);
    await keepFolderFor(id, folder);
    switchTo(id);
  };

  return (
    <>
      <p className="home-intro">Each workspace keeps its own pages, tabs and trash. Drag the cards to arrange them.</p>
      <ul className="workspace-grid" aria-label="Workspaces">
        {list.map((workspace) => (
          <Card
            key={workspace.id}
            workspace={workspace}
            app={app}
            count={workspace.id === app.workspace ? app.tree.visible.size : (counts[workspace.id] ?? null)}
            onBack={back}
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
        {"showDirectoryPicker" in window && (
          <li className="workspace-card workspace-new">
            <button className="workspace-open" onClick={() => void openFolder()}>
              <span className="workspace-card-title">
                <Icon name="folder" />
                <strong>Open a folder</strong>
              </span>
              <span className="workspace-card-meta">A folder of Markdown files, like an Obsidian vault, kept in step both ways</span>
            </button>
          </li>
        )}
      </ul>
    </>
  );
}

/** Ways to start: a new page of each kind there is, today's note when the calendar is on, and finding a page. */
export function QuickStart({ app }: { app: AppContext }) {
  const today = registry.commands(app).find((command) => command.id === "dates.today");
  const kinds = registry.kinds().filter((kind) => !kind.other && kind.kind !== "folder");
  return (
    <div className="home-actions">
      {kinds.map((kind) => (
        <button key={kind.kind} className="button" onClick={() => app.create(kind.kind)}>
          <Icon name={kind.icon} />
          {kind.label}
        </button>
      ))}
      {today && (
        <button className="button" onClick={() => today.run(app)}>
          <Icon name="calendar" />
          Today's note
        </button>
      )}
      <button className="button" onClick={app.openPalette}>
        <Icon name="search" />
        Find a page
      </button>
    </div>
  );
}

/** The pages opened last in this workspace, with when each was edited. */
/** Every page opened lately, as a page of its own. */
export function RecentView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const items = recentPages
    .use()
    .map((id) => app.tree.items.get(id))
    .filter((item): item is NonNullable<typeof item> => !!item && item.kind !== "folder");
  return <PageListView app={app} title="Recent pages" icon="clock" items={items} empty="Pages you open show up here." />;
}

export function RecentSection({ app }: { app: AppContext }) {
  const items = recentPages
    .use()
    .map((id) => app.tree.items.get(id))
    .filter((item): item is NonNullable<typeof item> => !!item && item.kind !== "folder")
    .slice(0, 8);
  return <HomeList app={app} items={items} note={(item) => editedAgo(item.editedAt)} empty="Pages you open show up here." />;
}

/** The panel that turns Home's cards on and off, orders them, and picks one or two columns. */
function Customize({ sections, onClose }: { sections: HomeSection[]; onClose(): void }) {
  const layout = homeLayout.use();
  const ids = arranged(sections, layout).map((section) => section.id);
  const byId = new Map(sections.map((section) => [section.id, section]));
  const set = (change: Partial<HomeLayout>) => homeLayout.set({ ...layout, ...change });
  return (
    <section className="home-customize" aria-label="Customize Home">
      <header className="home-customize-head">
        <strong>Customize Home</strong>
        <Segmented<"1" | "2">
          label="Columns"
          value={String(layout.columns) as "1" | "2"}
          options={[
            { value: "1", label: "One column" },
            { value: "2", label: "Two columns" },
          ]}
          onChange={(value) => set({ columns: value === "1" ? 1 : 2 })}
        />
        <button className="button" onClick={onClose}>
          Done
        </button>
      </header>
      <ol className="home-customize-list">
        {ids.map((id, i) => {
          const on = !layout.off.includes(id);
          const title = byId.get(id)!.title;
          return (
            <li key={id} data-off={!on || undefined}>
              <label>
                <input type="checkbox" checked={on} onChange={() => set({ off: on ? [...layout.off, id] : layout.off.filter((other) => other !== id) })} />
                <span>{title}</span>
              </label>
              <button className="icon-button" aria-label={`Move ${title} up`} disabled={i === 0} onClick={() => set({ order: moveCard(ids, id, -1) })}>
                <Icon name="chevron-up" />
              </button>
              <button className="icon-button" aria-label={`Move ${title} down`} disabled={i === ids.length - 1} onClick={() => set({ order: moveCard(ids, id, 1) })}>
                <Icon name="chevron-down" />
              </button>
            </li>
          );
        })}
      </ol>
      <button className="link-button" onClick={() => homeLayout.set({ order: [], off: [], columns: layout.columns })}>
        Back to how it came
      </button>
    </section>
  );
}

const greeting = (hour = new Date().getHours()) => (hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

/**
 * Home: a page of cards that plugins fill, like ways to start, recent pages,
 * bookmarks, books, the journal and the workspaces. People choose which show,
 * in what order, in one column or two. It is a page of its own, and what a
 * tab shows when it has nothing open.
 */
export function HomeView({ app }: { app: AppContext; options: Record<string, unknown> }) {
  const layout = homeLayout.use();
  const [customizing, setCustomizing] = useState(false);
  const sections = registry.homeSections();
  const shown = arranged(sections, layout).filter((section) => !layout.off.includes(section.id));
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="home-page" data-columns={layout.columns}>
      <header className="home-top">
        <div>
          <h1>Home</h1>
          <p className="home-date">
            {greeting()}. It is {today}.
          </p>
        </div>
        <button className="button" aria-expanded={customizing} onClick={() => setCustomizing(!customizing)}>
          <Icon name="settings" />
          Customize
        </button>
      </header>
      {customizing && <Customize sections={sections} onClose={() => setCustomizing(false)} />}
      <div className="home-grid">
        {shown.map((section) => (
          <section key={section.id} className="home-card" data-wide={section.wide || undefined} data-section={section.id} aria-label={section.title}>
            <h2 className="home-heading">
              {section.open ? (
                <button className="home-heading-link" title={`Open ${section.title} as a page`} onClick={() => section.open!(app)}>
                  {section.title}
                  <Icon name="chevron-right" />
                </button>
              ) : (
                section.title
              )}
            </h2>
            <Safe name={section.title}>
              <section.component app={app} />
            </Safe>
          </section>
        ))}
        {shown.length === 0 && <p className="home-empty">Every card is off. Customize turns them back on.</p>}
      </div>
    </div>
  );
}
