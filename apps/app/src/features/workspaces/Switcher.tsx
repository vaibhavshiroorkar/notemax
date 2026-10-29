import { useEffect, useRef, useState } from "react";
import { registry } from "@/plugins/registry";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { askText } from "@/ui/Prompt";
import { createWorkspace, nameOf, openList, rename, switchTo, workspaceList } from "./list";

/** A dot in the workspace's color, or an outline when it has none. */
export function Dot({ color }: { color: string }) {
  return <span className="workspace-dot" data-none={!color || undefined} style={color ? { background: color } : undefined} aria-hidden="true" />;
}

/** The workspace's name, typed over in place. Enter or leaving the box keeps it, Esc does not. */
function NameBox({ name, onDone }: { name: string; onDone(name: string | null): void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      className="workspace-rename"
      aria-label="Workspace name"
      autoFocus
      value={value}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value.trim() || null)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        else if (event.key === "Escape") onDone(null);
      }}
    />
  );
}

/**
 * The workspace at the top left: Home beside it, its name (double-click to
 * rename), a menu to switch or start another, and places like the community.
 */
export function Switcher({ app }: { app: AppContext }) {
  const list = workspaceList.use();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => void openList(), []);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => !wrapper.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = list.find((w) => w.id === app.workspace);
  const startNew = async () => {
    setOpen(false);
    const name = await askText({ title: "New workspace", label: "Name", placeholder: "Like Work, School or Novel", confirm: "Create" });
    if (name?.trim()) switchTo(await createWorkspace(name.trim()));
  };

  return (
    <div className="workspace-switch" ref={wrapper}>
      <button className="icon-button workspace-home" aria-label="Home" title="Home: all workspaces" onClick={() => app.openView("home")}>
        <Icon name="home" />
      </button>
      {renaming ? (
        <NameBox
          name={current ? nameOf(current) : "My notes"}
          onDone={(name) => {
            setRenaming(false);
            if (name && current && name !== nameOf(current)) void rename(current.id, name);
          }}
        />
      ) : (
        <button
          className="workspace-current"
          aria-haspopup="menu"
          aria-expanded={open}
          title="Switch workspace. Double-click to rename"
          onClick={() => setOpen(!open)}
          onDoubleClick={() => {
            setOpen(false);
            setRenaming(true);
          }}
        >
          <Dot color={current?.color ?? ""} />
          <span className="workspace-name">{current ? nameOf(current) : "My notes"}</span>
          <Icon name="chevron-down" />
        </button>
      )}
      {registry.switcherButtons().map((button) => (
        <button key={button.id} className="icon-button workspace-place" aria-label={button.label} title={button.label} onClick={() => button.run(app)}>
          <Icon name={button.icon} />
        </button>
      ))}
      {open && (
        <div className="menu workspace-menu" role="menu" aria-label="Workspaces">
          {list.map((workspace) => (
            <button key={workspace.id} className="menu-item" role="menuitemradio" aria-checked={workspace.id === app.workspace} onClick={() => switchTo(workspace.id)}>
              <Dot color={workspace.color} />
              <span className="workspace-name">{nameOf(workspace)}</span>
              {workspace.id === app.workspace && <span className="workspace-here">open</span>}
            </button>
          ))}
          <hr />
          <button
            className="menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setRenaming(true);
            }}
          >
            <Icon name="pencil" />
            Rename this workspace
          </button>
          <button className="menu-item" role="menuitem" onClick={() => void startNew()}>
            <Icon name="plus" />
            New workspace
          </button>
        </div>
      )}
    </div>
  );
}
