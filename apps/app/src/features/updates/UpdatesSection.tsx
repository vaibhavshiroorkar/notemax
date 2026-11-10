import { isDesktop } from "@/platform/platform";
import { APP_VERSION } from "@/version";
import { autoUpdate } from "@/platform/behavior";
import { checkForUpdate, installUpdate, updateState } from "./updates";
import { InfoTip } from "@/ui/InfoTip";
import { Loading } from "@/ui/Spinner";

function StateLine() {
  const now = updateState.use();
  switch (now.state) {
    case "checking":
      return <Loading className="updates-state">Checking...</Loading>;
    case "downloading":
      return <Loading className="updates-state">Downloading {now.version}...</Loading>;
    case "ready":
      return (
        <p className="updates-state">
          {now.version ? `Notemax ${now.version} is ready.` : "A new version is ready."}
          <button className="button button-primary" onClick={() => void installUpdate()}>
            {isDesktop ? "Restart to update" : "Reload to update"}
          </button>
        </p>
      );
    case "latest":
      return <p className="updates-state">You have the latest version.</p>;
    case "error":
      return <p className="updates-state warning">Could not check: {now.message}</p>;
    default:
      return null;
  }
}

/** The version, a button to look for a new one, and whether updates come on their own. */
export function UpdatesSection() {
  const auto = autoUpdate.use();
  const busy = ["checking", "downloading"].includes(updateState.use().state);
  return (
    <>
      <div className="settings-row">
        <span>Notemax {APP_VERSION}</span>
        <button className="button" disabled={busy} onClick={() => void checkForUpdate()}>
          Check for updates
        </button>
      </div>
      <StateLine />
      <label className="settings-row settings-check">
        <span>
          Update automatically
          <InfoTip label="About automatic updates">{isDesktop ? "Downloads new versions and installs them when the app restarts." : "Switches to a new version the next time the site opens."}</InfoTip>
        </span>
        <input type="checkbox" role="switch" checked={auto} onChange={(event) => autoUpdate.set(event.target.checked)} />
      </label>
    </>
  );
}
