import { withPageDoc } from "@/features/export/content";
import type { AppContext, Plugin } from "@/plugins/types";
import { CodePane } from "./CodePane";

/** The page's code as a file of its language. */
async function codeFile(id: string, workspace: string) {
  return withPageDoc(id, (doc) => ({ code: doc.getText("code").toString(), language: doc.getMap<string>("settings").get("language") === "javascript" ? "javascript" : "python" }), workspace);
}

export const codePlugin: Plugin = {
  id: "code",
  name: "Code pages",
  description: "Pages of Python or JavaScript that run right here, with their output below",
  kinds: [{ kind: "code", label: "New code page", icon: "code", other: true }],
  pageViews: [{ kind: "code", component: CodePane }],
  // A format's extension is fixed, so each language has its own.
  exporters: (["py", "js"] as const).map((extension) => ({
    id: `code-${extension}`,
    label: extension === "py" ? "Python file (.py)" : "JavaScript file (.js)",
    extension,
    kinds: ["code" as const],
    async build(node: { id: string }, app: AppContext) {
      const { code } = await codeFile(node.id, app.workspace);
      return new Blob([code], { type: "text/plain;charset=utf-8" });
    },
  })),
  commands: [{ id: "code.new", title: "New code page", keywords: ["python", "javascript", "script", "run", "program"], run: (app) => app.create("code") }],
};
