// An example community plugin. In Notemax: Settings, Plugins, Allow community
// plugins, then Install from a file and pick this file.
//
// It shows "4 min read" at the top right of a note, adds "Today's date" to the
// / menu, and adds a command to Ctrl+K.

const ID = "example.reading-time";

export default function plugin(api) {
  const h = api.React.createElement;

  function ReadingTime({ node }) {
    // Options are read with a hook, so the corner updates as soon as it is switched.
    if (!api.useOption(ID, "show")) return null;
    const minutes = Math.max(1, Math.round(node.words / 230));
    return h("span", { className: "page-words" }, `${minutes} min read`);
  }

  return {
    id: ID,
    name: "Reading time",
    version: "1.0.0",
    author: "Notemax",
    description: "Reading time at the top right of a note, and today's date in the / menu",
    pageCorner: [{ id: "reading-time", kinds: ["note"], component: ReadingTime }],
    slashItems: [
      {
        title: "Today's date",
        hint: "",
        keywords: ["date", "today", "day"],
        apply: (chain) => chain.insertContent(new Date().toLocaleDateString()),
      },
    ],
    commands: [
      {
        id: `${ID}.count`,
        title: "Count the words in this page",
        when: (app) => app.activeId !== null,
        async run(app) {
          const text = await api.pageText(app.activeId);
          const words = text.split(/\s+/).filter(Boolean).length;
          app.notify(`${words} words`);
        },
      },
    ],
    options: [{ id: "show", label: "Show the reading time on notes", default: true }],
  };
}
