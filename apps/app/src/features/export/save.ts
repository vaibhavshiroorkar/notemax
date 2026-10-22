import { getOption } from "@/plugins/options";

type SavePicker = (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }>;

/**
 * Hands a file to the user. Normally it goes where the browser puts downloads.
 * With "Ask where to save" on, a Save dialog opens instead, where the browser
 * (and the desktop app's web view) offers one.
 */
export async function saveFile(blob: Blob, name: string): Promise<boolean> {
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker && getOption("downloads", "askWhere")) {
    try {
      const handle = await picker({ suggestedName: name });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (error) {
      // Cancel in the dialog is not an error worth showing.
      if (error instanceof DOMException && error.name === "AbortError") return false;
      throw error;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the download a moment after the click.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

/**
 * Opens the system print dialog for a page of HTML, where "Save as PDF" makes
 * the PDF. A hidden frame keeps the app itself out of the printout.
 */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.srcdoc = html;
    frame.onload = async () => {
      const win = frame.contentWindow!;
      // Pictures must be loaded or they print blank.
      await Promise.all([...win.document.images].map((img) => (img.complete ? null : new Promise((done) => (img.onload = img.onerror = done)))));
      win.focus();
      win.print();
      // print() returns when the dialog closes in most browsers; remove the frame a little later either way.
      setTimeout(() => frame.remove(), 1000);
      resolve();
    };
    document.body.append(frame);
  });
}
