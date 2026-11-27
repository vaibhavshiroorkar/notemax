// Releases one version everywhere: the Windows app, the Android app, then the
// website, which publishes both apps' files. Usage: pnpm release "<notes>"
//
// All three share one version and one sync format. Released apart, a device
// left on an older one can sync wrongly: 0.123.0 moved Drive files into
// subfolders that 0.122.0 and older never look in. So there is no way here to
// release one alone; the per-target scripts stay for retrying a failed step.
//
// Set the version first (pnpm version:set), commit, and tag it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const notes = process.argv.slice(2).join(" ") || `Notemax ${version}`;
// Fixed commands; only the notes come from outside, as one argument. pnpm is a .cmd file on Windows, which needs a shell.
const run = (...args) => execFileSync("pnpm", args, { cwd: root, stdio: "inherit", shell: true });
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

// What is released must be what the tag names, so a version can be rebuilt.
if (git("status", "--porcelain")) throw new Error("commit or stash your changes first: the release must match a commit");
const tagged = git("tag", "--points-at", "HEAD").split("\n");
if (!tagged.includes(`v${version}`)) throw new Error(`tag this commit v${version} first (git tag v${version})`);

run("desktop:release", JSON.stringify(notes));
run("android:release");
run("site:deploy");
console.log(`released ${version} to Windows, Android and the website`);
