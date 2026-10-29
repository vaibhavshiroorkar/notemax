import { showToast } from "./toast";

/**
 * Copies text and says how it went: "Copied the link", or why it could not.
 * A browser refuses when the page is not focused or the person said no.
 */
export const copyText = (text: string, what: string): Promise<boolean> =>
  navigator.clipboard.writeText(text).then(
    () => (showToast(`Copied ${what}`), true),
    () => (showToast("Could not reach the clipboard"), false),
  );
