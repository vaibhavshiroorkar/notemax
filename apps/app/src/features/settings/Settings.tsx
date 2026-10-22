import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { setOption, useOption } from "@/plugins/options";
import { registry } from "@/plugins/registry";
import type { Plugin, PluginOption, SettingsContext, SettingsSection } from "@/plugins/types";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { APP_VERSION } from "@/version";
import "./settings.css";

export function OptionRow({ plugin, option }: { plugin: Plugin; option: PluginOption }) {
  const on = useOption(plugin.id, option.id);
  return (
    <label className="settings-row settings-check">
      <span>
        {option.label}
        {option.description && <span className="settings-description">{option.description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(event) => setOption(plugin.id, option.id, event.target.checked)} />
    </label>
  );
}

function SectionBody({ section, ctx }: { section: SettingsSection; ctx: SettingsContext }) {
  const Body = section.component;
  return (
    <section className="settings-section" data-section={section.id}>
      <h3>
        <Icon name={section.icon} />
        {section.title}
      </h3>
      {Body && <Body {...ctx} />}
      {registry
        .options()
        .filter(({ option }) => option.section === section.id)
        .map(({ plugin, option }) => (
          <OptionRow key={`${plugin.id}.${option.id}`} plugin={plugin} option={option} />
        ))}
    </section>
  );
}

const groupOf = (section: SettingsSection) => section.group ?? "More";

/** Sections by order, with each group kept together where its first section falls. */
function grouped(sections: SettingsSection[]): SettingsSection[] {
  const firstAt = new Map<string, number>();
  sections.forEach((section, i) => firstAt.has(groupOf(section)) || firstAt.set(groupOf(section), i));
  return [...sections].sort((a, b) => firstAt.get(groupOf(a))! - firstAt.get(groupOf(b))!);
}

// Settings opens where it was left, until the app restarts.
let lastSection: string | undefined;

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean);
const matches = (text: string, query: string[]) => query.every((word) => text.toLowerCase().includes(word));

/**
 * The Settings dialog: categories on the left in groups, one shown at a time.
 * Searching shows every category with a match and hides the settings that do
 * not match. It reads the rows' own text, so a plugin's settings are
 * searchable with no extra work. A phone shows the list of categories first,
 * then one category with a way back.
 */
export function Settings({ onClose, initialSection, ...ctx }: SettingsContext & { onClose(): void; initialSection?: string }) {
  const sections = grouped(registry.settings());
  const [current, setCurrent] = useState(() => sections.find((s) => s.id === (initialSection ?? lastSection))?.id ?? sections[0]?.id);
  lastSection = current;
  // Phones only: the list of categories, or one category.
  const [pane, setPane] = useState<"list" | "section">(() => (initialSection ? "section" : "list"));
  const [query, setQuery] = useState("");
  const [found, setFound] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  const searching = query.trim() !== "";

  useLayoutEffect(() => {
    const root = content.current;
    if (!root) return;
    const terms = words(query);
    let any = false;
    for (const el of root.querySelectorAll<HTMLElement>(".settings-section")) {
      const section = sections.find((s) => s.id === el.dataset.section);
      const rows = [...el.querySelectorAll<HTMLElement>(".settings-row")];
      const hits = rows.filter((row) => matches(row.textContent ?? "", terms));
      // The title shows the whole section. Keywords do only when no setting
      // matches on its own, so "dark" shows the Theme row, not all of Appearance.
      const titleMatch = !!section && (matches(section.title, terms) || (!hits.length && matches((section.keywords ?? []).join(" "), terms)));
      let rowMatch = false;
      for (const row of rows) {
        const show = !searching || titleMatch || hits.includes(row);
        row.hidden = !show;
        rowMatch ||= show;
      }
      el.hidden = searching && !titleMatch && !rowMatch;
      el.dataset.partial = searching && !titleMatch ? "" : undefined;
      if (!searching) delete el.dataset.partial;
      any ||= !el.hidden;
    }
    setFound(any);
  });

  const shown = searching ? sections : sections.filter((s) => s.id === current);
  const currentTitle = sections.find((s) => s.id === current)?.title ?? "Settings";

  return (
    <Dialog label="Settings" onClose={onClose} className="settings">
      <div className="settings-layout" data-pane={searching ? "search" : pane}>
        <nav className="settings-nav" aria-label="Settings categories">
          <header className="settings-header">
            <h2 className="dialog-title">Settings</h2>
            <button className="icon-button settings-close" aria-label="Close settings" onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          <label className="settings-search">
            <Icon name="search" />
            <input type="search" placeholder="Search settings" aria-label="Search settings" data-autofocus value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="settings-nav-list">
            {sections.map((section, i) => (
              <Fragment key={section.id}>
                {(i === 0 || groupOf(section) !== groupOf(sections[i - 1])) && <p className="settings-nav-group">{groupOf(section)}</p>}
                <button
                  className="settings-nav-item"
                  aria-current={!searching && section.id === current ? "page" : undefined}
                  onClick={() => {
                    setQuery("");
                    setCurrent(section.id);
                    setPane("section");
                  }}
                >
                  <Icon name={section.icon} />
                  <span>{section.title}</span>
                  <Icon name="chevron-right" />
                </button>
              </Fragment>
            ))}
          </div>
          <p className="settings-version">Notemax {APP_VERSION}</p>
        </nav>
        <div className="settings-content" ref={content}>
          <header className="settings-content-top">
            <button className="settings-back" onClick={() => (searching ? setQuery("") : setPane("list"))}>
              <Icon name="chevron-left" />
              {searching ? "Clear search" : "Settings"}
            </button>
            <span className="settings-content-title">{searching ? "Search" : currentTitle}</span>
            <button className="icon-button" aria-label="Close settings" onClick={onClose}>
              <Icon name="close" />
            </button>
          </header>
          {shown.map((section) => (
            <SectionBody key={section.id} section={section} ctx={ctx} />
          ))}
          {searching && !found && <p className="settings-empty">No settings match "{query.trim()}".</p>}
        </div>
      </div>
    </Dialog>
  );
}
