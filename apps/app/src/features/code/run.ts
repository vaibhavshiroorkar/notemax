// Runs a code page in a worker of its own, so a long loop never freezes the
// app and Stop can end it at once. JavaScript needs nothing more. Python runs
// on Pyodide, which is downloaded once, the first time Python runs, and kept
// by the browser after that.

export type Language = "python" | "javascript";

export interface Line {
  kind: "out" | "err" | "info";
  text: string;
}

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

// Python's worker is kept between runs, since loading Pyodide takes seconds.
let python: Worker | null = null;

const workerFor = (source: string) => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));

export interface Run {
  stop(): void;
  done: Promise<void>;
}

/** Runs code and hands each line of output to `onLine` as it comes. */
export function run(language: Language, code: string, onLine: (line: Line) => void): Run {
  const worker = language === "python" ? (python ??= workerFor(PYTHON_WORKER)) : workerFor(JAVASCRIPT_WORKER);
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => (finish = resolve));
  let started = false;
  const loading = language === "python" ? setTimeout(() => !started && onLine({ kind: "info", text: "Getting Python ready. The first time takes a little while." }), 600) : undefined;

  worker.onmessage = ({ data }: MessageEvent<{ kind: string; text?: string }>) => {
    if (data.kind === "started") {
      started = true;
      clearTimeout(loading);
    } else if (data.kind === "done") {
      if (language === "javascript") worker.terminate();
      finish();
    } else onLine({ kind: data.kind as Line["kind"], text: data.text ?? "" });
  };
  worker.onerror = (event) => {
    onLine({ kind: "err", text: event.message || "The code could not run." });
    finish();
  };
  worker.postMessage({ code });

  return {
    stop() {
      worker.terminate();
      if (worker === python) python = null;
      clearTimeout(loading);
      onLine({ kind: "info", text: "Stopped." });
      finish();
    },
    done,
  };
}
