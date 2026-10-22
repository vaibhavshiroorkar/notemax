// Sets one version number everywhere it is written: every package.json, the
// Tauri config, and the desktop crate. Usage: pnpm version:set 0.17.0
// Then add a line for it to CHANGELOG.md, commit, and tag it v0.17.0.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Give a version like 0.17.0");
  process.exit(1);
}

const root = new URL("../", import.meta.url);
const edit = (file, change) => {
  const url = new URL(file, root);
  const before = readFileSync(url, "utf8");
  const after = change(before);
  if (after === before && !before.includes(version)) throw new Error(`No version found in ${file}`);
  writeFileSync(url, after);
  console.log(`${file}: ${version}`);
};

// A "version" line after "name", added the first time.
const json = (text) =>
  /^ {2}"version": ".*?",$/m.test(text)
    ? text.replace(/^ {2}"version": ".*?",$/m, `  "version": "${version}",`)
    : text.replace(/^( {2}"name": ".*?",)$/m, `$1\n  "version": "${version}",`);

for (const file of ["package.json", "apps/app/package.json", "apps/desktop/package.json", "packages/core/package.json", "apps/desktop/src-tauri/tauri.conf.json"]) {
  edit(file, json);
}
edit("apps/desktop/src-tauri/Cargo.toml", (text) => text.replace(/^version = ".*?"$/m, `version = "${version}"`));
// The lock names the crate's own version too, so a build does not rewrite it.
edit("apps/desktop/src-tauri/Cargo.lock", (text) => text.replace(/(name = "notemax"\r?\nversion = )".*?"/, `$1"${version}"`));
