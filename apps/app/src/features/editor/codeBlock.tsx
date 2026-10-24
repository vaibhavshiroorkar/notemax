import { useState } from "react";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { Icon } from "@/ui/Icon";

// Code blocks in notes: colored by language, with a language picker and a
// copy button on top. The node keeps the name "codeBlock" and its "language"
// setting, so notes written before read the same.

const lowlight = createLowlight({ bash, cpp, css, java, javascript, json, markdown, python, sql, typescript, xml });

const CHOICES: [string, string][] = [
  ["", "Plain text"],
  ["javascript", "JavaScript"],
  ["typescript", "TypeScript"],
  ["python", "Python"],
  ["java", "Java"],
  ["cpp", "C++"],
  ["sql", "SQL"],
  ["json", "JSON"],
  ["bash", "Shell"],
  ["css", "CSS"],
  ["xml", "HTML"],
  ["markdown", "Markdown"],
];

function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string | null) ?? "";
  const known = CHOICES.some(([value]) => value === language);
  return (
    <NodeViewWrapper as="div" className="code-block">
      <div className="code-block-bar" contentEditable={false}>
        <select aria-label="Code language" value={known ? language : ""} disabled={!editor.isEditable} onChange={(event) => updateAttributes({ language: event.target.value || null })}>
          {!known && <option value="">{language}</option>}
          {CHOICES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-button"
          aria-label={copied ? "Copied" : "Copy code"}
          title={copied ? "Copied" : "Copy code"}
          onClick={() =>
            void navigator.clipboard.writeText(node.textContent).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            })
          }
        >
          <Icon name="copy" />
        </button>
      </div>
      <pre>
        <NodeViewContent<"code"> as="code" className={language ? `language-${language}` : undefined} />
      </pre>
    </NodeViewWrapper>
  );
}

export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView);
  },
}).configure({ lowlight, defaultLanguage: null });
