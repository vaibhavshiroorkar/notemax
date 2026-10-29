import { linksOpen, newPagesAt, newTabShows, showWelcome, sidebarOpens, type NewTabShows, type Where } from "@/platform/behavior";
import { Segmented } from "@/ui/Segmented";

const WHERE: { value: Where; label: string }[] = [
  { value: "here", label: "This tab" },
  { value: "new-tab", label: "A new tab" },
];

const NEW_TAB: { value: NewTabShows; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "search", label: "Search" },
  { value: "note", label: "A new note" },
];

/** Choices about how the app acts, each starting the way it always worked. */
export function BehaviorSection() {
  const welcome = showWelcome.use();
  return (
    <>
      <div className="settings-row">
        <span>Pages in the sidebar open in</span>
        <Segmented<Where> label="Pages in the sidebar open in" value={sidebarOpens.use()} options={WHERE} onChange={sidebarOpens.set} />
      </div>
      <div className="settings-row">
        <span>Links open in</span>
        <Segmented<Where> label="Links open in" value={linksOpen.use()} options={WHERE} onChange={linksOpen.set} />
      </div>
      <div className="settings-row">
        <span>A new tab shows</span>
        <Segmented<NewTabShows> label="A new tab shows" value={newTabShows.use()} options={NEW_TAB} onChange={newTabShows.set} />
      </div>
      <div className="settings-row">
        <span>New pages go</span>
        <Segmented<"end" | "top">
          label="New pages go"
          value={newPagesAt.use()}
          options={[
            { value: "end", label: "At the end" },
            { value: "top", label: "At the top" },
          ]}
          onChange={newPagesAt.set}
        />
      </div>
      <label className="settings-row settings-check">
        <span>Open a Welcome tab in each new workspace</span>
        <input type="checkbox" role="switch" checked={welcome} onChange={(event) => showWelcome.set(event.target.checked)} />
      </label>
    </>
  );
}
