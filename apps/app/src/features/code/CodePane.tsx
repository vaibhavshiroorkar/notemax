import { lazy, Suspense, useEffect, useState } from "react";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { LANGUAGES, languageOf, type Language } from "./languages";
import { readsInput, run, type Line, type Run } from "./run";
import "./code.css";

// CodeMirror and its languages load with the first code page, not with the app.
const CodeEditor = lazy(() => import("./CodeEditor").then((m) => ({ default: m.CodeEditor })));

function Output({ lines }: { lines: Line[] }) {
  return (
    <div className="code-output" aria-label="Output" aria-live="polite">
      {lines.map((line, i) =>
        line.kind === "progress" ? (
          <div key={i} className="code-progress">
            <span className="code-info">
              {line.label}: {Math.round(line.done / 1048576)} of {Math.round(line.total / 1048576)} MB, kept for next time
            </span>
            <progress value={line.done} max={line.total || 1} />
          </div>
        ) : line.kind === "table" ? (
          <div key={i} className="code-table-wrap">
            <table className="code-table">
              <thead>
                <tr>
                  {line.columns.map((column, c) => (
                    <th key={c}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {line.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, c) => (
                      <td key={c} data-null={cell === null || undefined}>
                        {cell === null ? "NULL" : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <span className="code-info">
              {line.rows.length} {line.rows.length === 1 ? "row" : "rows"}
            </span>
          </div>
        ) : (
          <pre key={i} className={`code-line code-${line.kind}`}>
            {line.text}
          </pre>
        ),
      )}
    </div>
  );
}

/** A page of code with a Run button. The code syncs like a note; what it printed stays on this device. */
export function CodePane({ node, app, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const [language, setLanguage] = useState<Language>("python");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState<Run | null>(null);
  const [stdin, setStdin] = useState("");
  const [showInput, setShowInput] = useState(false);
  useEffect(() => onStatus(status), [status, onStatus]);

  useEffect(() => {
    if (!local) return;
    const text = local.doc.getText("code");
    const settings = local.doc.getMap<string>("settings");
    const read = () => setLanguage(languageOf(settings.get("language")));
    read();
    onReady();
    settings.observe(read);
    // Typing in the editor marks the page as edited, for its date in lists.
    const touch = (_event: unknown, transaction: { local: boolean }) => transaction.local && touchNode(workspaceDoc, node.id);
    text.observe(touch);
    return () => {
      settings.unobserve(read);
      text.unobserve(touch);
    };
  }, [local, onReady, workspaceDoc, node.id]);

  const start = (reset = false) => {
    if (running || !local) return;
    setLines([]);
    const begun = performance.now();
    // A newer download bar takes the place of the last, so the output shows one.
    const add = (line: Line) => setLines((all) => (line.kind === "progress" && all.at(-1)?.kind === "progress" ? [...all.slice(0, -1), line] : [...all, line]));
    const current = run(language, local.doc.getText("code").toString(), add, { stdin, page: `${app.workspace}:${node.id}`, reset });
    setRunning(current);
    void current.done.then(() => {
      setRunning(null);
      setLines((all) => [...all, { kind: "info", text: `Done in ${Math.round(performance.now() - begun)} ms.` }]);
    });
  };

  if (openError) return <p className="error">Could not open this page: {openError}</p>;

  return (
    <div className="code-page">
      <header className="code-header">
        <input
          className="note-title code-title"
          value={node.title}
          placeholder="Untitled code"
          aria-label="Code page title"
          autoFocus={node.title === ""}
          onChange={(event) => renameNode(workspaceDoc, node.id, event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && (document.querySelector<HTMLElement>(".code-editor .cm-content")?.focus())}
        />
        <PageHeader node={node} app={app} />
      </header>
      <div className="code-bar">
        <select aria-label="Language" value={language} onChange={(event) => local?.doc.getMap<string>("settings").set("language", event.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        {running ? (
          <button className="button" onClick={() => running.stop()}>
            <Icon name="close" />
            Stop
          </button>
        ) : (
          <button className="button button-primary" title="Run (Ctrl+Enter)" onClick={() => start()}>
            <Icon name="bolt" />
            Run
          </button>
        )}
        {language === "sql" && !running && (
          <button className="link-button" title="Run with an empty database" onClick={() => start(true)}>
            Run from empty
          </button>
        )}
        {readsInput(language) && (
          <button className="link-button" aria-expanded={showInput} onClick={() => setShowInput(!showInput)}>
            Input
          </button>
        )}
        {lines.length > 0 && !running && (
          <button className="link-button" onClick={() => setLines([])}>
            Clear output
          </button>
        )}
      </div>
      {local ? (
        <Suspense fallback={<div className="code-editor code-loading">Loading the editor...</div>}>
          <CodeEditor text={local.doc.getText("code")} language={language} onRun={() => start()} />
        </Suspense>
      ) : (
        <div className="code-editor code-loading" />
      )}
      {showInput && readsInput(language) && (
        <label className="code-stdin">
          <span>Input, read a line at a time by input()</span>
          <textarea value={stdin} spellCheck={false} rows={3} aria-label="Input" onChange={(event) => setStdin(event.target.value)} />
        </label>
      )}
      {language === "java" && <p className="code-info">Java runs a class with a main method. It has no Input box here.</p>}
      {lines.length > 0 && <Output lines={lines} />}
    </div>
  );
}
