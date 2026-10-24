// Fetches the Java compiler that code pages run in the browser: TeaVM's build
// of javac for WebAssembly (Apache License 2.0, https://github.com/konsoletyper/teavm-javac).
// teavm.org does not let other sites load these files, so the app serves its
// own copy from /runtimes/teavm/. They are downloaded here, before dev and
// build, and kept out of git. Each file is checked against the hash below, so
// a changed file upstream stops the build instead of shipping something unknown.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://teavm.org/playground/3/";
const FILES = {
  "compiler.wasm": "7f3828e4b7bddf5504dadebfc4016e40f4441e15ee0519071781813ba2ed3a4c",
  "compiler.wasm-runtime.js": "9ff6a6771f698be00ab9d5c7b46d904350a8d4115dc0b409553f31ed66688a55",
  "compile-classlib-teavm.bin": "e80ae10423a39290c5f20b6bb6da34d21c3ad0a75cd8dbdda4998d2813045e15",
  "runtime-classlib-teavm.bin": "ea670e71967eda93828cb894c1741a8ed2e94b3422eb99cb9eccec0de67daaa8",
};

const NOTICE = `These files run Java in Notemax code pages. They are TeaVM's build of
javac for WebAssembly, downloaded from https://teavm.org/playground/3/.

TeaVM and teavm-javac: Copyright Alexey Andreev, Apache License 2.0,
https://github.com/konsoletyper/teavm and https://github.com/konsoletyper/teavm-javac

The class libraries include parts of OpenJDK, under the GNU General Public
License version 2 with the Classpath Exception. Their source is at
https://github.com/openjdk/jdk
`;

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "apps", "app", "public", "runtimes", "teavm");
const sha = (data) => createHash("sha256").update(data).digest("hex");

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "NOTICE.txt"), NOTICE);
let missing = 0;
for (const [name, hash] of Object.entries(FILES)) {
  const path = join(out, name);
  if (existsSync(path) && sha(readFileSync(path)) === hash) continue;
  try {
    const response = await fetch(BASE + name);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (sha(data) !== hash) {
      console.error(`fetch-runtimes: ${name} changed upstream (sha256 ${sha(data)}). Check it, then update the hash in scripts/fetch-runtimes.mjs.`);
      process.exit(1);
    }
    writeFileSync(path, data);
    console.log(`fetch-runtimes: got ${name} (${Math.round(data.length / 1024)} KB)`);
  } catch (error) {
    // Offline: the app still builds, and Java pages say Java is not here.
    missing++;
    console.warn(`fetch-runtimes: could not get ${name}: ${error.message}`);
  }
}
if (missing) console.warn("fetch-runtimes: Java will not run in this build until the files can be downloaded.");
