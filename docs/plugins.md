# Writing a Notemax plugin

Everything in Notemax is a plugin: books, boards, tags and the graph all use
the same API that community plugins use. A community plugin is one JavaScript
file. People install it from Settings, Plugins: first "Allow community
plugins", then "Install from a file" or paste an `https://` address.

A plugin runs with the same access as the app. It can read and change every
note. Say plainly in your plugin's description what it does.

## The file

The file is an ES module. Its default export is a function that gets the API
and returns the plugin:

```js
export default function plugin(api) {
  return {
    id: "yourname.word-goal",
    name: "Word goal",
    version: "1.0.0",
    author: "Your name",
    description: "One line for the plugin list",
    commands: [{ id: "yourname.word-goal.hello", title: "Say hello", run: (app) => app.notify("Hello") }],
  };
}
```

The id must be lowercase letters, digits, dots or dashes. Start it with your
name so it never clashes with someone else's.

`examples/plugins/reading-time.js` is a full example that adds something to
the top right of a page, the / menu, Ctrl+K, and the plugin's own setting.

## Drawing

Plugins draw with the app's own React, from `api.React`. Never bundle your own
copy. Without a build step, use `createElement`:

```js
const h = api.React.createElement;
const Hello = ({ node }) => h("span", { className: "page-words" }, `Hi from ${node.title}`);
```

With a bundler, set JSX to the classic runtime with `api.React.createElement`
and mark `react` as external.

## The API

| Name | What it is |
|---|---|
| `api.apiVersion` | `1`. It goes up only when something breaks plugins. |
| `api.React` | The app's React. |
| `api.core` | Workspace helpers: `readTree`, `createNode`, `renameNode`, `moveNode`, `addTag`, `buildGraph`, `countWords`, `plainText` and more. |
| `api.ui` | `Icon`, `Dialog` and `ConfirmDialog`, so plugins look like the app. |
| `api.useOption(pluginId, optionId)` | A hook: the value of an on or off option. Also `getOption` and `setOption`. |
| `api.notify(message, action?)` | A short message at the bottom of the window. |
| `api.pageText(id)` | A page's body as plain text. |

Commands, panels and other parts get `app`, the open workspace: `app.tree`,
`app.activeId`, `app.open(id)`, `app.create(kind)`, `app.trash(id)`,
`app.notify`, `app.openSettings`, `app.openOverlay` and more.

## What a plugin can add

Every field is optional.

| Field | Where it shows |
|---|---|
| `commands` | Ctrl+K, with an optional shortcut users can change. |
| `slashItems` | The / menu in notes. |
| `editorExtensions(ctx)` | Tiptap extensions for the note editor: menus, keys, input rules. |
| `contentExtensions(ctx)` | Node and mark types a note can hold. These load even while the plugin is switched off, so switching it off never drops content. `ctx.on` says whether it is on. |
| `sidePanels` | A section of the right sidebar, with `order` and `when(app)`. |
| `pageCorner` | The top right of a page. |
| `pageHeader` | Under a page's title. |
| `pageFooter` | At the end of a page. |
| `sidebarSections` | The left sidebar, between the pages and the trash. With an `order` below 0, above the pages, like Starred. |
| `sidebarFooter` | The bar at the bottom of the left sidebar, left of the Settings cog, like the account and sync. |
| `overlays` | Full-window views, opened with `app.openOverlay(id)`. |
| `views` | Pages of their own that open in a tab, like the graph. Open one with `app.openView(id)`. |
| `statusItems` | The status bar at the bottom, like how sync is going. |
| `start(app)` | Runs once when the main window has opened the workspace, like starting sync. |
| `settings` | A category in Settings. |
| `options` | On or off switches. Without a `section`, they show under Plugins. |
| `shortcutHints` | Keys listed in the shortcut list (Ctrl+/). |
| `contextMenu` | Right-click menus. See below. |
| `exporters` | Download formats, listed under "Download as". See below. |

Community plugins cannot add new kinds of pages yet.

### Right-click menus

Each item names the `targets` it shows on:

- `page`: a page's row in a sidebar, its title in the chapter list, or its dot in the graph.
- `pages`: several rows picked with Ctrl+click or Shift+click. Read `target.nodes`, in the order the sidebar shows them.
- `editor`: inside a note. Read `target.editor` for the selection.
- `sidebar`: empty space in the left sidebar.
- `download`: the download button at the top right of a page.
- `tab`: a tab above the page.

Items with the same `group` sit together, with a line between groups. Built-in groups keep a fixed order (open, clipboard, create, edit, duplicate, format, block, insert, link, image, tags, layout, share, select, danger). New groups go after them. `when` hides an item, `disabled` greys it out, `submenu` opens a small menu to the side, and `danger` draws it in red.

```js
contextMenu: [
  {
    id: "yourname.count-words",
    title: "Count words in selection",
    group: "select",
    targets: ["editor"],
    when: (target) => !target.editor.state.selection.empty,
    run: (target, app) => {
      const { from, to } = target.editor.state.selection;
      const words = target.editor.state.doc.textBetween(from, to, " ").split(/\s+/).filter(Boolean).length;
      app.notify(`${words} words`);
    },
  },
],
```

### Download formats

An exporter lists the page `kinds` it handles and builds a `Blob` from the page. Return a .zip blob when a format needs extra files, and it is saved as .zip. Return `null` when the exporter finished the job itself, as PDF does by opening the print dialog.

```js
exporters: [
  {
    id: "yourname.word-list",
    label: "Word list (.txt)",
    extension: "txt",
    kinds: ["note"],
    build: async (node) => {
      const text = await api.pageText(node.id);
      const words = [...new Set(text.toLowerCase().match(/[\p{L}']+/gu) ?? [])].sort();
      return new Blob([words.join("\n")], { type: "text/plain" });
    },
  },
],
```

## When something goes wrong

- If a part of your plugin throws while drawing, only that part shows an error.
  The rest of the app keeps working.
- Errors while loading show under the plugin in Settings.
- If Notemax closes while plugins load, the next start skips them and says so.
- On the web, adding `?safe` to the address starts without community plugins.
