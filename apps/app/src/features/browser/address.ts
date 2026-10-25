// What a typed address means: a web address as it is, a bare name like
// "example.com" with https:// in front, and anything else a web search.

// Searches go to Google. Google refuses to show inside another page's frame,
// except when the address carries igu=1, which forFrame adds. The desktop app
// shows sites in a real web view, which needs no such thing.
export const FRAME_SEARCH = "https://www.google.com/search?q=";
export const VIEW_SEARCH = FRAME_SEARCH;

const GOOGLE_HOST = /^(www\.)?google\.[a-z.]+$/;
const GOOGLE_PAGES = ["/", "/webhp", "/search"];

/**
 * The address a frame loads for `address`. Google's home and search pages
 * get igu=1, the switch that lets Google show inside another page. Other
 * sites load as they are.
 */
export function forFrame(address: string): string {
  try {
    const url = new URL(address);
    if (!GOOGLE_HOST.test(url.hostname) || !GOOGLE_PAGES.includes(url.pathname)) return address;
    if (url.pathname === "/") url.pathname = "/webhp";
    url.searchParams.set("igu", "1");
    return url.href;
  } catch {
    return address;
  }
}

/**
 * The address to load, or null when it may not be shown here. Only http and
 * https pages load, and never one from this app's own site: framed with
 * scripts on, it could reach the app.
 */
export function addressFor(typed: string, { here = location.origin, search = FRAME_SEARCH } = {}): string | null {
  const text = typed.trim();
  if (!text) return null;
  let url: URL;
  try {
    // "localhost:5173" and "example.com:8080" look like a scheme, so only known schemes count as one.
    const scheme = /^(https?|ftp|file|javascript|data|about|blob|mailto|vbscript):/i.test(text);
    const host = /^[^\s/]+\.[^\s/]{2,}(\/|$)/.test(text) || /^localhost(:\d+)?(\/|$)/.test(text) || /^[^\s/]+:\d+(\/|$)/.test(text);
    url = new URL(scheme ? text : host ? `https://${text}` : `${search}${encodeURIComponent(text)}`);
  } catch {
    return `${search}${encodeURIComponent(text)}`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.origin === here) return null;
  return url.href;
}

/** The site's name, for a page with no title yet. */
export const siteOf = (address: string) => {
  try {
    return new URL(address).hostname.replace(/^www\./, "");
  } catch {
    return address;
  }
};
