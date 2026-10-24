// Holds javac, as TeaVM built it for WebAssembly. TeaVM's own code answers the
// messages: load-classlib, then compile, which returns the program as a
// WebAssembly module. The files come from the app's own /runtimes/teavm/.
const base = `${self.location.origin}/runtimes/teavm/`;
const { load } = await import(/* @vite-ignore */ `${base}compiler.wasm-runtime.js`);
const teavm = await load(`${base}compiler.wasm`);
teavm.exports.installWorker();

export {};
