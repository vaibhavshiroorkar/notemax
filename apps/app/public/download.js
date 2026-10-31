// The download page (download.html). Plain JavaScript: it is a static page
// outside the app, so it loads fast and works even if the app does not.

const agent = navigator.userAgent;
const system = /Android/.test(agent) ? "android" : /Windows/.test(agent) ? "windows" : null;

// The visitor's own system goes first, marked, so the right button is the first one seen.
if (system) {
  const card = document.getElementById(system);
  card.classList.add("card-here");
  card.querySelector(".here").hidden = false;
  card.parentElement.prepend(card);
}

const mb = (bytes) => `${Math.round(bytes / 1024 / 1024)} MB`;

// The desktop release (scripts/release-desktop.mjs) writes latest.json next to
// the installer. The installer's own address is used as a path, so the page
// also works on a preview deploy and on the dev server.
async function findInstaller() {
  const link = document.getElementById("windows-download");
  const meta = document.getElementById("windows-meta");
  try {
    const response = await fetch("/desktop/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    const latest = await response.json();
    const path = new URL(latest.platforms["windows-x86_64"].url).pathname;
    const version = latest.version.replace(/\.0$/, "");
    link.href = path;
    link.removeAttribute("aria-disabled");
    meta.textContent = `Version ${version}`;
    // The size is a nicety: the download works without it.
    const head = await fetch(path, { method: "HEAD" }).catch(() => null);
    const size = Number(head?.headers.get("content-length"));
    if (size > 0) meta.textContent = `Version ${version}, ${mb(size)}`;
  } catch {
    link.removeAttribute("href");
    meta.textContent = "The installer could not be found right now. Try again in a little while.";
  }
}
void findInstaller();

// Android browsers that can install the web app say so with this event. Only
// on Android: on a PC the same button would install a browser window, which is
// not what the Android card offers.
if (system === "android") {
  const install = document.getElementById("android-install");
  const steps = document.getElementById("android-steps");
  const done = document.getElementById("android-done");
  let prompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    prompt = event;
    install.hidden = false;
    steps.hidden = true;
  });
  install.addEventListener("click", async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") install.hidden = true;
    prompt = null;
  });
  window.addEventListener("appinstalled", () => {
    install.hidden = true;
    steps.hidden = true;
    done.hidden = false;
  });
  // On the phone itself, the first step is where they already are.
  steps.querySelector("li").textContent = "Open this page in Chrome.";
}
