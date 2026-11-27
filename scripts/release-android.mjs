// Builds the Android app and puts it with latest.json in apps/app/public/android/.
// The next web build copies them into the site. The app looks there for a
// newer version, and the Get the app tab links the newest one.
//
// The app is the Tauri app from apps/desktop, built for Android, with the web
// app inside it (scripts/phone-web.mjs). It needs the Android SDK with the NDK,
// and a JDK (Android Studio's own is used when JAVA_HOME is not set).
//
// The signing key lives outside the repo, in ~/.notemax/android/. Android
// installs an update only when it is signed with the same key, so keep a copy safe.
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "./check-env.mjs";

const ALIAS = "notemax";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const android = join(root, "apps/desktop/src-tauri/gen/android");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const sdk = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
const ndks = existsSync(join(sdk, "ndk")) ? readdirSync(join(sdk, "ndk")).sort() : [];
const ndk = process.env.NDK_HOME ?? (ndks.length ? join(sdk, "ndk", ndks.at(-1)) : null);
if (!ndk) throw new Error(`no NDK in ${sdk}: install "NDK (Side by side)" in Android Studio's SDK Manager`);
const studioJdk = "C:/Program Files/Android/Android Studio/jbr";
const jdk = process.env.JAVA_HOME ?? (existsSync(studioJdk) ? studioJdk : null);
if (!jdk) throw new Error("no JDK found: set JAVA_HOME, or install Android Studio");
const keytool = join(jdk, "bin", "keytool.exe");

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

// Gradle reads the key from here (app/build.gradle.kts). It holds the
// password, so it exists only while the build runs, and git ignores it.
const properties = join(android, "keystore.properties");
writeFileSync(properties, `storeFile=${keystore.replaceAll("\\", "/")}\npassword=${password}\nkeyAlias=${ALIAS}\n`);
const outputs = join(android, "app/build/outputs/apk");
rmSync(outputs, { recursive: true, force: true });
try {
  // 64-bit ARM is every phone of the last several years. More targets would double the size.
  // pnpm is a .cmd file on Windows, which needs a shell. The arguments are fixed.
  execFileSync("pnpm", ["--filter", "@notemax/desktop", "tauri", "android", "build", "--apk", "--target", "aarch64"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ANDROID_HOME: sdk, NDK_HOME: ndk, JAVA_HOME: jdk, GRADLE_OPTS: "-Dorg.gradle.daemon=false" },
  });
} finally {
  rmSync(properties, { force: true });
}

const find = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? find(join(dir, e.name)) : e.name.endsWith(".apk") ? [join(dir, e.name)] : []));
const apk = find(outputs).find((path) => /release/.test(path));
if (!apk) throw new Error(`the build made no release APK under ${outputs}`);
if (/unsigned/.test(apk)) throw new Error(`the APK is not signed: ${apk}`);
const size = statSync(apk).size;
if (size > 25 * 1024 * 1024) throw new Error(`the APK is ${(size / 1048576).toFixed(1)} MiB, over the 25 MiB a page file may be`);

const out = join(root, "apps/app/public/android");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const file = `Notemax_${version}.apk`;
copyFileSync(apk, join(out, file));
writeFileSync(join(out, "latest.json"), `${JSON.stringify({ version, file, pub_date: new Date().toISOString() }, null, 2)}\n`);
console.log(`ready in apps/app/public/android: ${file} (${(size / 1048576).toFixed(1)} MiB) and latest.json for ${version}`);
