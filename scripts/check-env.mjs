// Stops a release built without the Supabase settings. Without them the app
// hides sign-in and sync, and still builds fine, so nothing else would notice:
// 0.123.0 shipped that way from a fresh clone, whose apps/app/.env is gitignored.
// Every release step runs this first.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "app", ".env");
const NEEDED = {
  VITE_SUPABASE_URL: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
  // The publishable key only. A secret key in the app would give everyone full access.
  VITE_SUPABASE_ANON_KEY: /^sb_publishable_[A-Za-z0-9_-]+$/,
};

const values = existsSync(file)
  ? Object.fromEntries(
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
        .filter(Boolean)
        .map(([, name, value]) => [name, value]),
    )
  : {};
const wrong = Object.entries(NEEDED)
  .filter(([name, shape]) => !shape.test(values[name] ?? ""))
  .map(([name]) => name);

if (wrong.length) {
  console.error(`check-env: ${wrong.join(" and ")} missing or wrong in apps/app/.env. Without them the app has no sign-in or sync. See apps/app/.env.example.`);
  process.exit(1);
}
console.log("check-env: Supabase settings present");
