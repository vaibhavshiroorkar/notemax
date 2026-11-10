import { useEffect, type ReactNode } from "react";
import { isDesktop } from "@/platform/platform";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { APP_VERSION } from "@/version";
import { askForDownloads, canInstall, downloads, inAndroidApp, installWebApp, megabytes, systemOf, type Download, type System } from "./offer";
import { Loading } from "@/ui/Spinner";

const here = systemOf();

/** A download link. The desktop app hands it to the browser, so its own window never leaves Notemax. */
function DownloadLink({ download, children }: { download: Download; children: ReactNode }) {
  return isDesktop ? (
    <a className="button button-primary get-app-download" href={download.url} target="_blank" rel="noopener noreferrer">
      <Icon name="download" />
      {children}
    </a>
  ) : (
    <a className="button button-primary get-app-download" href={download.url} download>
      <Icon name="download" />
      {children}
    </a>
  );
}

const about = (download: Download) => `Version ${download.version}${download.size ? `, ${megabytes(download.size)}` : ""}`;

function Card({ system, title, needs, points, children }: { system: System; title: string; needs: string; points: string[]; children: ReactNode }) {
  const mine = system === here;
  return (
    <section className="get-app-card" data-system={system} data-here={mine || undefined} aria-label={title}>
      {mine && <p className="get-app-here">For this device</p>}
      <h2>{title}</h2>
      <p className="get-app-needs">{needs}</p>
      <ul>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      {children}
    </section>
  );
}

function Windows() {
  const { windows } = downloads.use();
  if (isDesktop) return <p className="get-app-meta">This is the Windows app, version {APP_VERSION.replace(/\.0$/, "")}. It updates itself.</p>;
  if (windows === undefined) return <Loading className="get-app-meta">Finding the newest version...</Loading>;
  if (!windows) return <p className="get-app-meta">The installer could not be reached right now. Try again in a little while.</p>;
  return (
    <>
      <DownloadLink download={windows}>Download for Windows</DownloadLink>
      <p className="get-app-meta">{about(windows)}</p>
      <details className="get-app-help">
        <summary>Windows says the app is from an unknown publisher</summary>
        <p>
          The installer is not signed with a paid certificate yet, so Windows asks first. Choose <strong>More info</strong>, then <strong>Run anyway</strong>. Updates after that are
          checked against Notemax's own signature.
        </p>
      </details>
    </>
  );
}

function Android() {
  const { android } = downloads.use();
  const installable = canInstall.use();
  if (inAndroidApp) return <p className="get-app-meta">This is the Android app. It gets each new version on its own.</p>;
  return (
    <>
      {android === undefined && <Loading className="get-app-meta">Finding the newest version...</Loading>}
      {android && android !== "none" && (
        <>
          <DownloadLink download={android}>Download for Android</DownloadLink>
          <p className="get-app-meta">{about(android)}</p>
          <details className="get-app-help">
            <summary>How to install the downloaded file</summary>
            <ol>
              <li>Open the file from your downloads.</li>
              <li>If Android asks, allow your browser to install unknown apps, then go back.</li>
              <li>
                Tap <strong>Install</strong>.
              </li>
            </ol>
          </details>
        </>
      )}
      {android === null && <p className="get-app-meta">The Android download could not be reached right now. You can still install it from the browser.</p>}
      {android === "none" && <p className="get-app-meta">The Android app file is on its way. Until then, install it from the browser.</p>}
      {installable ? (
        <button className="button get-app-install" onClick={() => void installWebApp()}>
          Install from the browser instead
        </button>
      ) : (
        <details className="get-app-help" open={android === null || android === "none"}>
          <summary>Or install it from the browser</summary>
          <ol>
            <li>{here === "android" ? "Open notemax.pages.dev in Chrome." : "Open notemax.pages.dev in Chrome on your phone."}</li>
            <li>Tap the menu (the three dots at the top right).</li>
            <li>
              Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
            </li>
          </ol>
        </details>
      )}
    </>
  );
}

/** The downloads, in a tab of their own. The card for this device comes first. */
export function DownloadView(_: { app: AppContext; options: Record<string, unknown> }) {
  useEffect(askForDownloads, []);
  const cards = [
    <Card
      key="windows"
      system="windows"
      title="Windows"
      needs="Windows 10 or 11, 64-bit"
      points={["Your pages live in a file on your PC", "Sits in the tray, and Ctrl+Alt+N takes a quick note from anywhere", "Updates itself when a new version is out"]}
    >
      <Windows />
    </Card>,
    <Card key="android" system="android" title="Android" needs="Phones and tablets with Chrome" points={["Opens from your home screen like any app", "Works offline, with your pages on the phone", "Gets each new version on its own"]}>
      <Android />
    </Card>,
  ];
  if (here === "android") cards.reverse();
  return (
    <article className="note get-app-view">
      <h1 className="get-app-title">
        <Icon name="download" /> Get the app
      </h1>
      <p className="get-app-intro">The app opens on its own and works offline. Sign in to sync your pages.</p>
      <div className="get-app-cards">{cards}</div>
    </article>
  );
}
