// Runs a code page in a worker of its own, so a long loop never freezes the
// app and Stop can end it at once. JavaScript needs nothing more, and
// TypeScript is turned into JavaScript first. Python runs on Pyodide and SQL
// on SQLite, each downloaded once, the first time it runs, and kept by the
// browser after that.

import type { Language } from "./languages";

export type Line = { kind: "out" | "err" | "info"; text: string } | { kind: "table"; columns: string[]; rows: unknown[][] };

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

const PYTHON_WORKER = `
importScripts("${PYODIDE}pyodide.js");
const ready = loadPyodide({ indexURL: "${PYODIDE}" }).then((py) => {
  py.setStdout({ batched: (text) => postMessage({ kind: "out", text }) });
  py.setStderr({ batched: (text) => postMessage({ kind: "err", text }) });
  return py;
});
onmessage = async ({ data }) => {
  try {
    const py = await ready;
    const lines = data.stdin ? data.stdin.split("\\n") : [];
    py.setStdin({ stdin: () => (lines.length ? lines.shift() : undefined) });
    postMessage({ kind: "started" });
    await py.loadPackagesFromImports(data.code);
    const result = await py.runPythonAsync(data.code);
    if (result !== undefined && result !== null) postMessage({ kind: "out", text: String(result) });
  } catch (error) {
    postMessage({ kind: "err", text: String(error && error.message ? error.message : error) });
  }
  postMessage({ kind: "done" });
};
`;

const JAVASCRIPT_WORKER = `
const show = (value) => {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const say = (kind) => (...values) => postMessage({ kind, text: values.map(show).join(" ") });
console.log = console.info = console.debug = say("out");
console.warn = console.error = say("err");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
onmessage = async ({ data }) => {
  // input() and prompt() read the Input box, a line at a time.
  const lines = data.stdin ? data.stdin.split("\\n") : [];
  self.input = self.prompt = () => (lines.length ? lines.shift() : null);
  postMessage({ kind: "started" });
  try {
    const result = await new AsyncFunction(data.code)();
    if (result !== undefined) postMessage({ kind: "out", text: show(result) });
  } catch (error) {
    postMessage({ kind: "err", text: String(error && error.stack ? error.stack : error) });
  }
  postMessage({ kind: "done" });
};
`;

// Python's and SQL's workers are kept between runs, since loading takes seconds
// and SQL keeps each page's tables.
let python: Worker | null = null;
let sql: Worker | null = null;

const workerFor = (source: string) => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
const sqlWorker = () => new Worker(new URL("./sql.worker.ts", import.meta.url), { type: "module" });

export interface Run {
  stop(): void;
  done: Promise<void>;
}

export interface RunOptions {
  /** Lines that input() reads, one per call. */
  stdin?: string;
  /** The page's id, so SQL keeps one database per page. */
  page: string;
  /** SQL only: start from an empty database. */
  reset?: boolean;
}

/** Whether a language runs in this version, or only highlights. */
export const runs = (language: Language) => language !== "cpp" && language !== "java";

async function prepare(language: Language, code: string): Promise<string> {
  if (language !== "typescript") return code;
  const { transform } = await import("sucrase");
  return transform(code, { transforms: ["typescript"], disableESTransforms: true }).code;
}

/** Runs code and hands each line of output to `onLine` as it comes. */
export function run(language: Language, code: string, onLine: (line: Line) => void, options: RunOptions): Run {
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  if (!runs(language)) {
    onLine({ kind: "info", text: "This language is highlighted but does not run yet." });
    finish();
    return { stop: () => {}, done };
  }

  const kept = language === "python" || language === "sql";
  const worker = language === "python" ? (python ??= workerFor(PYTHON_WORKER)) : language === "sql" ? (sql ??= sqlWorker()) : workerFor(JAVASCRIPT_WORKER);
  let started = false;
  const loading = kept ? setTimeout(() => !started && onLine({ kind: "info", text: `Getting ${language === "python" ? "Python" : "SQLite"} ready. The first time takes a little while.` }), 600) : undefined;
  const end = () => {
    clearTimeout(loading);
    finish();
  };

  worker.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string; columns?: string[]; rows?: unknown[][] }>) => {
    if (data.kind === "started") {
      started = true;
      clearTimeout(loading);
    } else if (data.kind === "done") {
      if (!kept) worker.terminate();
      end();
    } else if (data.kind === "table") onLine({ kind: "table", columns: data.columns ?? [], rows: data.rows ?? [] });
    else onLine({ kind: data.kind as "out" | "err" | "info", text: data.text ?? "" });
  };
  worker.onerror = (event) => {
    onLine({ kind: "err", text: event.message || "The code could not run." });
    end();
  };
  prepare(language, code).then(
    (ready) => worker.postMessage({ code: ready, stdin: options.stdin ?? "", page: options.page, reset: options.reset }),
    (error: unknown) => {
      onLine({ kind: "err", text: String(error instanceof Error ? error.message : error) });
      if (!kept) worker.terminate();
      end();
    },
  );

  return {
    stop() {
      worker.terminate();
      if (worker === python) python = null;
      if (worker === sql) sql = null;
      onLine({ kind: "info", text: "Stopped." });
      end();
    },
    done,
  };
}
