// Decides, before the first paint, whether "/" shows the landing page or the
// app. It sets data-start="landing" or "app" on <html> (an attribute, since
// the app already styles a class named "app"); index.html and
// src/landing/landing.css read it, and src/app/main.tsx waits while it says
// landing. A plain blocking script, not inline, because the page's security
// policy refuses inline scripts.
//
// Only a first visit in a browser sees the landing page. Everyone else goes
// straight to the app: the desktop and Android apps, an installed web app,
// links with a hash or query (shared pages, workspace invites, sign-in
// returns), anyone who has used Notemax in this browser, and the dev server,
// so the checks open the app. "?landing" shows the landing page anyway and
// "?app" opens the app; both are taken off the address afterwards.
(function () {
  var root = document.documentElement;
  var search = location.search;
  var forced = search === "?landing" ? "landing" : search === "?app" ? "app" : "";
  if (forced) history.replaceState(null, "", location.pathname + location.hash);

  function usedHere() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        if ((localStorage.key(i) || "").indexOf("notemax:") === 0) return true;
      }
      return false;
    } catch (e) {
      // Storage is blocked, so the app will explain that itself. The landing page would only delay it.
      return true;
    }
  }

  function startsTheApp() {
    if ("__TAURI_INTERNALS__" in window) return true;
    var host = location.hostname;
    if (host === "tauri.localhost" || host === "localhost" || host === "127.0.0.1") return true;
    if (window.matchMedia("(display-mode: standalone)").matches || navigator.standalone) return true;
    if (location.hash || search) return true;
    return usedHere();
  }

  root.dataset.start = forced || (startsTheApp() ? "app" : "landing");
})();
