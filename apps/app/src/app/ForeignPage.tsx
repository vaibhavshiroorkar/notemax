import { useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { ROOT, createNode, restoreNode, trashNode, type Tree } from "@notemax/core";
import type * as Y from "yjs";
import { PageWorkspace } from "@/data/scope";
import { useWorkspace } from "@/data/useWorkspace";
import { LinkHub } from "@/features/links/link-hub";
import { pageStatus } from "@/features/status/StatusBar";
import { nameOf, switchTo, workspaceList } from "@/features/workspaces/list";
import { createStore } from "@/platform/store";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Safe } from "@/ui/Safe";
import { showToast } from "@/ui/toast";
import { revealing } from "./reveal";
import { openPage, type Visit } from "./tabs";
import { Gated } from "./Gated";

/** What makes a page from another workspace work: that workspace's tree and doc, and the page. */
export interface Scope {
  ws: string;
  name: string;
  tree: Tree;
  doc: Y.Doc;
  hub: LinkHub;
  nodeId: string | null;
}

/**
 * The scope of each workspace whose page is open in a tab while the sidebar
 * shows another. Menus opened inside such a page act through it, so they
 * change that workspace, never the shown one.
 */
export const foreignScopes = new Map<string, Scope>();

/** The scope of the active tab's page when that page is from another workspace, for the right sidebar. */
export const foreignActive = createStore<Scope | null>(null);

/** The app's context, changed to act on a scope's workspace instead of the shown one. */
export function scopedApp(base: AppContext, { ws, name, tree, doc, hub, nodeId }: Scope): AppContext {
  return {
    ...base,
    workspace: ws,
    tree,
    doc,
    hub,
    activeId: nodeId,
    open(id, where) {
      const host = where?.fromTrash ? undefined : registry.hostOf(tree, id);
      if (host) revealing.set(id);
      openPage(host ?? id, { ws, newTab: where?.newTab, options: where?.fromTrash ? { fromTrash: true } : undefined });
    },
    create(kind) {
      const id = createNode(doc, kind, ROOT);
      if (kind !== "folder") openPage(id, { ws });
    },
    trash(ids) {
      const list = typeof ids === "string" ? [ids] : [...ids];
      if (!list.length) return;
      const first = tree.byId.get(list[0]);
      doc.transact(() => list.forEach((id) => trashNode(doc, id)));
      const what = list.length > 1 ? `${list.length} pages` : `"${first?.title || "Untitled"}"`;
      showToast(`Moved ${what} to trash in ${name}`, { label: "Undo", run: () => doc.transact(() => list.forEach((id) => restoreNode(doc, id))) });
    },
  };
}

const ignore = () => {};

/**
 * A page from another workspace than the sidebar shows, fully working: it
 * opens that workspace's tree, and everything inside reads and saves there.
 * A line above it says where it is from.
 */
export function ForeignPage({ base, visit, active, version }: { base: AppContext; visit: Visit; active: boolean; version: number }) {
  const ws = visit.ws;
  const workspace = useWorkspace(ws);
  const [hub] = useState(() => new LinkHub((id) => openPage(id, { ws })));
  useLayoutEffect(() => {
    if (workspace.doc && workspace.tree) hub.update(workspace.doc, workspace.tree);
  }, [hub, workspace.doc, workspace.tree]);
  const info = workspaceList.use().find((w) => w.id === ws);
  const name = info ? nameOf(info) : "another workspace";

  const { doc, tree } = workspace;
  const hostId = tree ? registry.hostOf(tree, visit.page) : undefined;
  const node = tree ? (tree.items.get(hostId ?? visit.page) ?? (visit.options?.fromTrash ? tree.byId.get(visit.page) : undefined)) : undefined;

  const nodeId = node?.id ?? null;
  // The same object while nothing in it changes, so publishing it redraws nothing.
  const scope = useMemo<Scope | null>(() => (doc && tree ? { ws, name, tree, doc, hub, nodeId } : null), [ws, name, tree, doc, hub, nodeId]);
  const app = scope ? scopedApp(base, scope) : null;

  useLayoutEffect(() => {
    if (!scope) return;
    foreignScopes.set(ws, scope);
    if (active) foreignActive.set(scope);
  }, [scope, ws, active]);
  useLayoutEffect(
    () => () => {
      if (active) foreignActive.set(null);
    },
    [active],
  );

  if (workspace.openError) return <p className="empty pane-empty">The workspace this page is in could not be opened.</p>;
  if (!app || !tree || !doc) return null;
  const Page = node && registry.pageView(node.kind)?.component;
  return (
    <PageWorkspace.Provider value={ws}>
      <div className="foreign-page" data-workspace={ws}>
        <p className="foreign-line">
          <span className="workspace-dot" style={{ "--workspace-color": info?.color || undefined } as CSSProperties} />
          <span>From {name}</span>
          <button className="link-button" onClick={() => switchTo(ws)}>
            Show {name} in the sidebar
          </button>
        </p>
        {node && Page ? (
          <Safe key={`${ws}:${node.id}:${version}`} name="This page">
            <Gated node={node} app={app}>
              <Page node={node} app={app} tree={tree} workspaceDoc={doc} hub={hub} onSelect={(id) => app.open(id)} onStatus={active ? pageStatus.set : ignore} onReady={ignore} />
            </Gated>
          </Safe>
        ) : (
          <p className="empty pane-empty">This page is gone.</p>
        )}
      </div>
    </PageWorkspace.Provider>
  );
}
