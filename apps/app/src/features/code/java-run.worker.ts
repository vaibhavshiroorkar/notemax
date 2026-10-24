// Runs one compiled Java program. A worker per run, so Stop can end it.
// TeaVM's runtime hands each printed character to putchar; lines go out whole.
const base = `${self.location.origin}/runtimes/teavm/`;

self.onmessage = async ({ data }: MessageEvent<{ script: Int8Array }>) => {
  const { load } = await import(/* @vite-ignore */ `${base}compiler.wasm-runtime.js`);
  const lines = { out: "", err: "" };
  const put = (kind: "out" | "err") => (ch: number) => {
    if (ch === 10) {
      self.postMessage({ kind, text: lines[kind] });
      lines[kind] = "";
    } else lines[kind] += String.fromCharCode(ch);
  };
  try {
    const program = await load(data.script, {
      installImports(imports: { teavmConsole: Record<string, unknown> }) {
        imports.teavmConsole.putcharStdout = put("out");
        imports.teavmConsole.putcharStderr = put("err");
      },
    });
    self.postMessage({ kind: "started" });
    await program.exports.main([]);
  } catch (error) {
    self.postMessage({ kind: "err", text: String(error instanceof Error ? error.message : error) });
  }
  for (const kind of ["out", "err"] as const) if (lines[kind]) self.postMessage({ kind, text: lines[kind] });
  self.postMessage({ kind: "done" });
};

export {};
