import { allowAgain, checkNow, mirrorView, pickFolder, stopFolder, useFolder } from "./mirror";

const when = (time: number | null) => (time ? new Date(time).toLocaleTimeString(undefined, { timeStyle: "short" }) : "not yet");

/** Settings, Markdown files: which folder this workspace keeps, and how it is going. */
export function MarkdownSection() {
  const view = mirrorView.use();
  const choose = async () => {
    const folder = await pickFolder();
    if (folder) await useFolder(folder);
  };

  return (
    <>
      <p>
        Keep every note of this workspace as a plain Markdown file in a folder you choose, as well as in Notemax. Edit them in any app: changes come back
        here, and the note as it was is kept as a version. Folders stay folders, and books become folders of numbered chapters.
      </p>
      {view.state === "unsupported" && <p className="warning">This browser cannot keep files in a folder. Chrome, Edge and the desktop app can.</p>}
      {view.state === "off" && (
        <div className="settings-row">
          <span>No folder yet</span>
          <button className="button" onClick={() => void choose()}>
            Choose a folder...
          </button>
        </div>
      )}
      {view.state === "needs-permission" && (
        <div className="settings-row">
          <span>
            Notemax needs your permission again to use the folder {view.folder}.
            <span className="settings-description">Browsers ask again after a restart, unless you let it allow this site every time.</span>
          </span>
          <button className="button button-primary" onClick={() => void allowAgain()}>
            Allow
          </button>
        </div>
      )}
      {view.state === "on" && (
        <>
          <div className="settings-row">
            <span>
              Keeping the folder <strong>{view.folder}</strong>
              <span className="settings-description">
                {view.files} {view.files === 1 ? "file" : "files"}, last looked at {when(view.checked)}
              </span>
            </span>
            <button className="button" onClick={() => void checkNow()}>
              Check now
            </button>
          </div>
          {view.error && <p className="warning">{view.error}</p>}
          <div className="settings-row">
            <span>
              Stop keeping files
              <span className="settings-description">The files stay in the folder as they are.</span>
            </span>
            <button className="button" onClick={() => void stopFolder()}>
              Stop
            </button>
          </div>
        </>
      )}
    </>
  );
}
