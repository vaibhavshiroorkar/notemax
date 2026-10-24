// Runs a code page in a worker of its own, so a long loop never freezes the
// app and Stop can end it at once. JavaScript needs nothing more, and
// TypeScript is turned into JavaScript first. Python runs on Pyodide, SQL on
// SQLite, C++ on Clang and Java on TeaVM's javac, each downloaded once, the
// first time it runs, and kept by the browser after that.

import type { Language } from "./languages";

export type Line =
  | { kind: "out" | "err" | "info"; text: string }
  | { kind: "table"; columns: string[]; rows: unknown[][] }
  /** A download under way. A newer one takes the place of the last. */
  | { kind: "progress"; label: string; done: number; total: number };

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

// Python's, SQL's and C++'s workers are kept between runs, since loading
// takes seconds and SQL keeps each page's tables.
let python: Worker | null = null;
let sql: Worker | null = null;
let cpp: Worker | null = null;

const workerFor = (source: string) => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
const sqlWorker = () => new Worker(new URL("./sql.worker.ts", import.meta.url), { type: "module" });
const cppWorker = () => new Worker(new URL("./cpp.worker.ts", import.meta.url), { type: "module" });

const JAVA = "/runtimes/teavm/";

interface Compiled {
  status?: string;
  script?: Int8Array;
}

/** javac, loaded once with its class library, answering one request at a time. */
class JavaCompiler {
  private worker = new Worker(new URL("./java-compiler.worker.ts", import.meta.url), { type: "module" });
  private next = 0;
  private waiting = new Map<string, (data: Compiled) => void>();
  onDiagnostic: (text: string) => void = () => {};
  readonly ready: Promise<void>;

  constructor() {
    const started = new Promise<void>((resolve, reject) => {
      this.worker.onerror = (event) => reject(new Error(event.message || "Java could not start."));
      this.worker.onmessage = ({ data }) => {
        if (data.command === "initialized") return resolve();
        const done = this.waiting.get(data.id);
        if (done && (data.command === "ok" || data.command === "compilation-complete")) {
          this.waiting.delete(data.id);
          return done(data);
        }
        if (data.command === "compiler-diagnostic" || data.command === "diagnostic") {
          const where = data.lineNumber ? `line ${data.lineNumber}${data.columnNumber ? `, column ${data.columnNumber}` : ""}: ` : "";
          const severity = data.severity === "error" ? "Error" : data.severity === "warning" ? "Warning" : "Note";
          this.onDiagnostic(`${severity}, ${where}${data.message ?? data.text ?? ""}`);
        }
      };
    });
    this.ready = started.then(async () => {
      await this.ask({ command: "load-classlib", url: `${JAVA}compile-classlib-teavm.bin`, runtimeUrl: `${JAVA}runtime-classlib-teavm.bin` });
    });
  }

  ask(message: object): Promise<Compiled> {
    const id = String(this.next++);
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage({ id, ...message });
    });
  }
}
let java: JavaCompiler | null = null;

/** Java: compile with javac, then run the program in a worker of its own. */
function runJava(code: string, onLine: (line: Line) => void): Run {
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  let runner: Worker | null = null;
  let stopped = false;
  const compiler = (java ??= new JavaCompiler());
  const loading = setTimeout(() => onLine({ kind: "info", text: "Getting Java ready. The first time downloads about 7 MB." }), 600);
  compiler.onDiagnostic = (text) => onLine({ kind: "err", text });
  void (async () => {
    try {
      await compiler.ready;
      clearTimeout(loading);
      const result = await compiler.ask({ command: "compile", text: code });
      if (stopped) return;
      if (result.status !== "successful" || !result.script) {
        onLine({ kind: "err", text: "It did not compile." });
        return finish();
      }
      runner = new Worker(new URL("./java-run.worker.ts", import.meta.url), { type: "module" });
      runner.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string }>) => {
        if (data.kind === "done") {
          runner?.terminate();
          finish();
        } else if (data.kind !== "started") onLine({ kind: data.kind as "out" | "err", text: data.text ?? "" });
      };
      runner.postMessage({ script: result.script });
    } catch (error) {
      clearTimeout(loading);
      onLine({ kind: "err", text: `Java is not available here: ${error instanceof Error ? error.message : String(error)}` });
      java = null;
      finish();
    }
  })();
  return {
    stop() {
      stopped = true;
      clearTimeout(loading);
      runner?.terminate();
      onLine({ kind: "info", text: "Stopped." });
      finish();
    },
    done,
  };
}

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

/** Whether input() and its kind read the Input box. Java's runtime here has no standard input. */
export const readsInput = (language: Language) => language !== "sql" && language !== "java";

async function prepare(language: Language, code: string): Promise<string> {
  if (language !== "typescript") return code;
  const { transform } = await import("sucrase");
  return transform(code, { transforms: ["typescript"], disableESTransforms: true }).code;
}

/** Runs code and hands each line of output to `onLine` as it comes. */
export function run(language: Language, code: string, onLine: (line: Line) => void, options: RunOptions): Run {
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  if (language === "java") return runJava(code, onLine);

  const kept = language === "python" || language === "sql" || language === "cpp";
  const worker =
    language === "python" ? (python ??= workerFor(PYTHON_WORKER)) : language === "sql" ? (sql ??= sqlWorker()) : language === "cpp" ? (cpp ??= cppWorker()) : workerFor(JAVASCRIPT_WORKER);
  let started = false;
  // C++ shows its own download bar.
  const loading =
    language === "python" || language === "sql"
      ? setTimeout(() => !started && onLine({ kind: "info", text: `Getting ${language === "python" ? "Python" : "SQLite"} ready. The first time takes a little while.` }), 600)
      : undefined;
  const end = () => {
    clearTimeout(loading);
    finish();
  };

  worker.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string; columns?: string[]; rows?: unknown[][]; label?: string; done?: number; total?: number }>) => {
    if (data.kind === "progress") onLine({ kind: "progress", label: data.label ?? "Downloading", done: data.done ?? 0, total: data.total ?? 0 });
    else if (data.kind === "started") {
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
      if (worker === cpp) cpp = null;
      onLine({ kind: "info", text: "Stopped." });
      end();
    },
    done,
  };
}
