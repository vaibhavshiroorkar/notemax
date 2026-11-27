// Copies the Java compiler that code pages run in the browser into the app's
// public folder: TeaVM's build of javac for WebAssembly (Apache License 2.0,
// https://github.com/konsoletyper/teavm-javac). The app serves its own copy
// from /runtimes/teavm/, because teavm.org does not let other sites load them.
//
// The files live in vendor/teavm/, in git. They used to be downloaded from
// teavm.org on every build, but teavm.org changes compiler.wasm in place, so CI
// failed whenever it served a different build than the one tested here.
// Each file is checked against the hash below, so a swapped file stops the build.
// To take a new upstream build: download it from https://teavm.org/playground/3/,
// test Java pages, then replace the file in vendor/teavm/ and its hash here.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = {
  "compiler.wasm": "7f3828e4b7bddf5504dadebfc4016e40f4441e15ee0519071781813ba2ed3a4c",
  "compiler.wasm-runtime.js": "9ff6a6771f698be00ab9d5c7b46d904350a8d4115dc0b409553f31ed66688a55",
  "compile-classlib-teavm.bin": "e80ae10423a39290c5f20b6bb6da34d21c3ad0a75cd8dbdda4998d2813045e15",
  "runtime-classlib-teavm.bin": "ea670e71967eda93828cb894c1741a8ed2e94b3422eb99cb9eccec0de67daaa8",
};

const NOTICE = `These files run Java in Notemax code pages. They are TeaVM's build of
javac for WebAssembly, from https://teavm.org/playground/3/.

TeaVM and teavm-javac: Copyright Alexey Andreev, Apache License 2.0,
https://github.com/konsoletyper/teavm and https://github.com/konsoletyper/teavm-javac

The class libraries include parts of OpenJDK, under the GNU General Public
License version 2 with the Classpath Exception. Their source is at
https://github.com/openjdk/jdk
`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "vendor", "teavm");
const out = join(root, "apps", "app", "public", "runtimes", "teavm");
const sha = (data) => createHash("sha256").update(data).digest("hex");

mkdirSync(out, { recursive: true });
for (const [name, hash] of Object.entries(FILES)) {
  const data = readFileSync(join(from, name));
  if (sha(data) !== hash) {
    console.error(`copy-runtimes: vendor/teavm/${name} does not match its hash in scripts/copy-runtimes.mjs (got ${sha(data)}).`);
    process.exit(1);
  }
  writeFileSync(join(out, name), data);
}
writeFileSync(join(out, "NOTICE.txt"), NOTICE);
console.log("copy-runtimes: Java runtime ready");
