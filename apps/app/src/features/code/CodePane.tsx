import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type * as Y from "yjs";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import { PageHeader } from "@/plugins/PageHeader";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { run, type Language, type Line, type Run } from "./run";
import "./code.css";

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
];

/** Changes the shared text to `next` by the smallest edit, so two people typing in different places both keep their text. */
function setText(text: Y.Text, next: string) {
  const now = text.toString();
  if (now === next) return;
  let start = 0;
  while (start < now.length && start < next.length && now[start] === next[start]) start++;
  let end = 0;
  while (end < now.length - start && end < next.length - start && now[now.length - 1 - end] === next[next.length - 1 - end]) end++;
  text.doc!.transact(() => {
    text.delete(start, now.length - start - end);
    text.insert(start, next.slice(start, next.length - end));
  });
}

/** A page of code with a Run button. The code syncs like a note; what it printed stays on this device. */
export function CodePane({ node, app, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language>("python");
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState<Run | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => onStatus(status), [status, onStatus]);

  useEffect(() => {
    if (!local) return;
    const text = local.doc.getText("code");
    const settings = local.doc.getMap<string>("settings");
    const read = () => {
      setCode(text.toString());
      setLanguage(settings.get("language") === "javascript" ? "javascript" : "python");
    };
    read();
    onReady();
    text.observe(read);
    settings.observe(read);
    return () => {
      text.unobserve(read);
      settings.unobserve(read);
    };
  }, [local, onReady]);

  const edit = (next: string) => {
    if (!local) return;
    setCode(next);
    setText(local.doc.getText("code"), next);
    touchNode(workspaceDoc, node.id);
  };

  const start = () => {
    if (running) return;
    setLines([]);
    const begun = performance.now();
    const current = run(language, code, (line) => setLines((all) => [...all, line]));
    setRunning(current);
    void current.done.then(() => {
      setRunning(null);
      setLines((all) => [...all, { kind: "info", text: `Done in ${Math.round(performance.now() - begun)} ms.` }]);
    });
  };

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      start();
    } else if (event.key === "Tab" && !event.shiftKey) {
      // A tab in code is four spaces, not a jump out of the box.
      event.preventDefault();
      const el = event.currentTarget;
      const { selectionStart: from, selectionEnd: to } = el;
      edit(`${code.slice(0, from)}    ${code.slice(to)}`);
      requestAnimationFrame(() => el.setSelectionRange(from + 4, from + 4));
    }
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
          onKeyDown={(event) => event.key === "Enter" && area.current?.focus()}
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
          <button className="button button-primary" title="Run (Ctrl+Enter)" onClick={start}>
            <Icon name="bolt" />
            Run
          </button>
        )}
        {lines.length > 0 && !running && (
          <button className="link-button" onClick={() => setLines([])}>
            Clear output
          </button>
        )}
      </div>
      <textarea
        ref={area}
        className="code-input"
        aria-label="Code"
        spellCheck={false}
        value={code}
        placeholder={language === "python" ? 'print("Hello")' : 'console.log("Hello")'}
        onChange={(event) => edit(event.target.value)}
        onKeyDown={onKey}
      />
      {lines.length > 0 && (
        <pre className="code-output" aria-label="Output" aria-live="polite">
          {lines.map((line, i) => (
            <span key={i} className={`code-line code-${line.kind}`}>
              {line.text}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}
