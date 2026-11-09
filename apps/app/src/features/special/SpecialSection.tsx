import type { SettingsContext } from "@/plugins/types";
import { SearchSelect } from "@/ui/SearchSelect";
import { DAILY_TITLES, dailyTitle } from "./titles";
import { ROLES, holder, setRole } from "./roles";
import { InfoTip } from "@/ui/InfoTip";

const NONE = "";

/** Settings, Special pages: which page does each job, and how daily notes are named. */
export function SpecialSection({ app }: SettingsContext) {
  const format = dailyTitle.use();
  const sample = new Date();
  return (
    <>
      {ROLES.map((role) => {
        const current = holder(app.tree, role.id);
        const pages = [...app.tree.items.values()]
          .filter((item) => role.kinds.includes(item.kind))
          .sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled"));
        return (
          <div key={role.id} className="settings-row">
            <span>
              {role.label}
              <InfoTip label={`About ${role.label}`}>{role.description}</InfoTip>
            </span>
            <SearchSelect
              label={role.label}
              value={current?.id ?? NONE}
              shown={{ label: current ? current.title || "Untitled" : role.id === "dailyFolder" ? "A new Daily notes folder" : "None" }}
              choices={[
                { value: NONE, label: role.id === "dailyFolder" ? "A new Daily notes folder" : "None" },
                ...pages.map((item) => ({ value: item.id, label: item.title || "Untitled", hint: item.kind })),
              ]}
              onChange={(value) => setRole(app.doc, app.tree, role.id, value || null)}
            />
          </div>
        );
      })}
      <label className="settings-row">
        <span>Daily note titles</span>
        <select className="settings-select" value={format} onChange={(event) => dailyTitle.set(event.target.value as typeof format)}>
          {DAILY_TITLES.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.format(sample)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
