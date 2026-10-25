// What a typed address means: a web address as it is, a bare name like
// "example.com" with https:// in front, and anything else a web search.

// Most search sites refuse to show inside another page's frame; Bing allows
// it. The desktop app shows sites in a real web view, where Google works.
export const FRAME_SEARCH = "https://www.bing.com/search?q=";
export const VIEW_SEARCH = "https://www.google.com/search?q=";

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
