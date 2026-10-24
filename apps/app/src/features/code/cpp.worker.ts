// Compiles C++ with Clang, built for WebAssembly by YoWASP (LLVM's licence,
// Apache 2.0 with LLVM exceptions; the wrapper is ISC), then runs the program
// with a small WASI layer. Clang comes from jsdelivr the first time, about
// 23 MB, and the browser keeps it, so later runs start at once.
import { ConsoleStdout, File, OpenFile, WASI } from "@bjorn3/browser_wasi_shim";

const CLANG = "https://cdn.jsdelivr.net/npm/@yowasp/clang@22.0.0-git20542-10/gen/bundle.js";

interface Clang {
  runClang(args: string[], files: Record<string, string | Uint8Array>, options: object): Promise<Record<string, string | Uint8Array>>;
}
let clang: Promise<Clang> | null = null;

const text = new TextDecoder();
/** Turns printed bytes into whole lines, one message each. `flush` sends what is left, like a last line with no newline. */
function lines(kind: "out" | "err") {
  let rest = "";
  const write = (bytes: Uint8Array | null) => {
    if (!bytes) return;
    rest += text.decode(bytes, { stream: true });
    const parts = rest.split(String.fromCharCode(10));
    rest = parts.pop() ?? "";
    for (const line of parts) self.postMessage({ kind, text: line });
  };
  const flush = () => {
    if (rest) self.postMessage({ kind, text: rest });
    rest = "";
  };
  return { write, flush };
}

self.onmessage = async ({ data }: MessageEvent<{ code: string; stdin: string }>) => {
  try {
    clang ??= import(/* @vite-ignore */ CLANG) as Promise<Clang>;
    const { runClang } = await clang;
    let built: Record<string, string | Uint8Array>;
    try {
      built = await runClang(["clang++", "-O1", "-std=c++20", "-fno-exceptions", "main.cpp", "-o", "main.wasm"], { "main.cpp": data.code }, {
        stdout: lines("err").write,
        stderr: lines("err").write,
        decodeASCII: false,
        fetchProgress: ({ totalLength, doneLength }: { totalLength: number; doneLength: number }) => self.postMessage({ kind: "progress", label: "Getting C++ ready", done: doneLength, total: totalLength }),
      });
    } catch {
      // Clang printed why, line by line, above.
      self.postMessage({ kind: "err", text: "It did not compile." });
      self.postMessage({ kind: "done" });
      return;
    }
    self.postMessage({ kind: "started" });
    const program = await WebAssembly.compile(built["main.wasm"] as Uint8Array<ArrayBuffer>);
    const out = lines("out");
    const err = lines("err");
    const wasi = new WASI(["main"], [], [new OpenFile(new File(new TextEncoder().encode(data.stdin))), new ConsoleStdout(out.write), new ConsoleStdout(err.write)]);
    const instance = await WebAssembly.instantiate(program, { wasi_snapshot_preview1: wasi.wasiImport });
    const code = wasi.start(instance as { exports: { memory: WebAssembly.Memory; _start: () => unknown } });
    out.flush();
    err.flush();
    if (code) self.postMessage({ kind: "info", text: `Ended with code ${code}.` });
  } catch (error) {
    self.postMessage({ kind: "err", text: String(error instanceof Error ? error.message : error) });
  }
  self.postMessage({ kind: "done" });
};
