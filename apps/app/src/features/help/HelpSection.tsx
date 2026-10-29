import { useState } from "react";
import { registry } from "@/plugins/registry";
import type { SettingsContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { searchQuestions } from "./faq";

/** Common questions with short answers, searched as you type. Each can open the setting it talks about. */
export function HelpSection({ app }: SettingsContext) {
  const [query, setQuery] = useState("");
  const found = searchQuestions(query);
  const sections = new Map(registry.settings().map((section) => [section.id, section.title]));
  return (
    <>
      <label className="settings-search help-search">
        <Icon name="search" />
        <input type="search" placeholder="Search questions" aria-label="Search questions" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {found.length ? (
        <div className="help-list">
          {found.map((question) => (
            <details key={question.q} className="help-item" open={found.length === 1 || undefined}>
              <summary>{question.q}</summary>
              <p>{question.a}</p>
              {question.section && sections.has(question.section) && (
                <button className="link-button" onClick={() => app.openSettings(question.section)}>
                  Open {sections.get(question.section)}
                </button>
              )}
            </details>
          ))}
        </div>
      ) : (
        <p className="help-none">No question matches. Try fewer words.</p>
      )}
    </>
  );
}
