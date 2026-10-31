// Builds the Android app and puts it with latest.json in apps/app/public/android/.
// The next web build copies them into the site, and the Get the app tab links
// the newest one.
//
// The app is a Trusted Web Activity: the website in a full-screen Chrome
// window, made by Bubblewrap from apps/android/twa-manifest.json. Chrome shows
// it without an address bar only when the site vouches for the app, through
// /.well-known/assetlinks.json with the signing key's fingerprint. This script
// writes that file too, so commit it when it changes.
//
// Needs JDK 17 (Bubblewrap refuses newer ones) and the Android SDK. The
// signing key lives outside the repo, in ~/.notemax/android/. Android installs
// an update only when it is signed with the same key, so keep a copy safe.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUBBLEWRAP = "@bubblewrap/cli@1.27.0";
const ALIAS = "notemax";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const project = join(root, "apps/android");
const manifestPath = join(project, "twa-manifest.json");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

/** JDK 17: JAVA_HOME when it is one, else the usual install folders. */
function findJdk() {
  const looks = (dir) => dir && existsSync(join(dir, "bin", "keytool.exe")) && /17/.test(dir);
  if (looks(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  for (const parent of ["C:/Program Files/Eclipse Adoptium", "C:/Program Files/Microsoft", "C:/Program Files/Java"]) {
    if (!existsSync(parent)) continue;
    const found = readdirSync(parent).find((name) => /^jdk-?17/.test(name));
    if (found) return join(parent, found);
  }
  throw new Error("no JDK 17 found. Install one with: winget install EclipseAdoptium.Temurin.17.JDK");
}

// Bubblewrap runs java without quoting its path, so a JDK under "Program Files"
// breaks at the space. A junction gives it a path with none.
function withoutSpaces(dir) {
  if (!dir.includes(" ")) return dir;
  const link = join(homedir(), ".notemax", "jdk-17");
  if (existsSync(link) && realpathSync(link) !== realpathSync(dir)) rmSync(link);
  if (!existsSync(link)) {
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(dir, link, "junction");
  }
  if (link.includes(" ")) throw new Error(`the JDK needs a path without spaces, and ${link} has one`);
  return link;
}

const jdk = withoutSpaces(findJdk());
const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
if (!existsSync(join(sdk, "build-tools"))) throw new Error(`no Android SDK with build-tools at ${sdk}`);
const keytool = join(jdk, "bin", "keytool.exe");
// Bubblewrap accepts an SDK only when it has a tools or bin folder, as its own
// download of the command line tools does. Android Studio's SDK has neither,
// yet holds everything the build uses, so an empty bin folder is enough.
if (!existsSync(join(sdk, "tools")) && !existsSync(join(sdk, "bin"))) mkdirSync(join(sdk, "bin"));

// Bubblewrap asks where the JDK and SDK are on its first run. Telling it here skips the questions.
const config = join(homedir(), ".bubblewrap", "config.json");
mkdirSync(dirname(config), { recursive: true });
writeFileSync(config, JSON.stringify({ jdkPath: jdk, androidSdkPath: sdk }, null, 2));

// The signing key, made once. Its password sits next to it, also outside the repo.
const keys = join(homedir(), ".notemax", "android");
const keystore = join(keys, "notemax-android.keystore");
const passwordFile = join(keys, "password.txt");
mkdirSync(keys, { recursive: true });
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(24).toString("base64url"));
const password = readFileSync(passwordFile, "utf8").trim();
if (!existsSync(keystore)) {
  execFileSync(keytool, ["-genkeypair", "-keystore", keystore, "-alias", ALIAS, "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-storepass", password, "-keypass", password, "-dname", "CN=Notemax"], { stdio: "inherit" });
}
const listing = execFileSync(keytool, ["-list", "-v", "-keystore", keystore, "-alias", ALIAS, "-storepass", password], { encoding: "utf8" });
const fingerprint = listing.match(/SHA256:\s*([0-9A-F:]+)/)?.[1];
if (!fingerprint) throw new Error("could not read the signing key's SHA-256 fingerprint");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
// pnpm version:set writes the version into the manifest. A release of any other one is a mistake.
if (manifest.appVersion !== version) throw new Error(`twa-manifest.json says ${manifest.appVersion}, the app is ${version}: run pnpm version:set ${version}`);
manifest.fingerprints = [{ name: "release", value: fingerprint }];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const assetlinks = join(root, "apps/app/public/.well-known/assetlinks.json");
mkdirSync(dirname(assetlinks), { recursive: true });
writeFileSync(
  assetlinks,
  `${JSON.stringify([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: manifest.packageId, sha256_cert_fingerprints: [fingerprint] } }], null, 2)}\n`,
);

// npx is a .cmd file on Windows, which needs a shell. The arguments are fixed or our own paths.
// Bubblewrap runs gradlew.bat from the project folder and jarsigner from the
// JDK, both by name. A shell with NoDefaultCurrentDirectoryInExePath set never
// looks in the project folder, so PATH names both.
const env = {
  ...process.env,
  PATH: `${project};${join(jdk, "bin")};${process.env.PATH}`,
  JAVA_HOME: jdk,
  ANDROID_HOME: sdk,
  BUBBLEWRAP_KEYSTORE_PASSWORD: password,
  BUBBLEWRAP_KEY_PASSWORD: password,
  // A Gradle daemon left running holds the build files, and the next update cannot clear them.
  GRADLE_OPTS: "-Dorg.gradle.daemon=false",
};
const bubblewrap = (args) => execFileSync("npx", ["--yes", BUBBLEWRAP, ...args], { cwd: project, stdio: "inherit", env, shell: true });
bubblewrap(["update", "--skipVersionUpgrade", `--manifest="${manifestPath}"`]);
bubblewrap(["build", "--skipPwaValidation", `--manifest="${manifestPath}"`, `--signingKeyPath="${keystore}"`, `--signingKeyAlias=${ALIAS}`]);

const apk = join(project, "app-release-signed.apk");
if (!existsSync(apk)) throw new Error(`Bubblewrap made no ${apk}`);
const size = statSync(apk).size;
if (size > 25 * 1024 * 1024) throw new Error(`the APK is ${(size / 1048576).toFixed(1)} MiB, over the 25 MiB a page file may be`);

const out = join(root, "apps/app/public/android");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const file = `Notemax_${version}.apk`;
copyFileSync(apk, join(out, file));
writeFileSync(join(out, "latest.json"), `${JSON.stringify({ version, file, pub_date: new Date().toISOString() }, null, 2)}\n`);
console.log(`ready in apps/app/public/android: ${file} and latest.json for ${version}`);
console.log(`assetlinks.json has fingerprint ${fingerprint}; commit it if it changed`);
