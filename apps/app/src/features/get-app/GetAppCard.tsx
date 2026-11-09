import { useEffect, useState } from "react";
import type { AppContext } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { DOWNLOAD_VIEW, mayOffer, offerAnswered, systemOf } from "./offer";

// Long enough that the first look at the app comes first, and a quick visit never sees it.
const WAIT_MS = 15_000;

/** A card in the corner of the browser version, once, offering the Windows or Android app. */
export function GetAppCard({ app }: { app: AppContext }) {
  const answered = offerAnswered.use();
  const [due, setDue] = useState(false);
  const offer = mayOffer() && !answered;

  useEffect(() => {
    if (!offer) return;
    const timer = setTimeout(() => setDue(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, [offer]);

  if (!offer || !due) return null;
  const android = systemOf() === "android";
  return (
    <section className="get-app" role="dialog" aria-label="Get the Notemax app">
      <header className="get-app-head">
        <Icon name="download" />
        <strong>Get the Notemax app</strong>
        <button className="icon-button" aria-label="Close" onClick={() => offerAnswered.set(true)}>
          <Icon name="close" />
        </button>
      </header>
      <p className="get-app-text">
        {android
          ? "The Android app opens from your home screen like any other app and works offline."
          : "The Windows app keeps your pages in a file on your PC, works offline, and updates itself."}
      </p>
      <div className="get-app-actions">
        <button
          className="button button-primary"
          onClick={() => {
            offerAnswered.set(true);
            app.openView(DOWNLOAD_VIEW);
          }}
        >
          See the downloads
        </button>
        <button className="link-button" onClick={() => offerAnswered.set(true)}>
          Not now
        </button>
      </div>
    </section>
  );
}

/** Home's card: a way to the downloads. */
export function GetAppHome({ app }: { app: AppContext }) {
  return (
    <>
      <p className="home-intro">For Windows and Android. Works offline.</p>
      <button className="button get-app-home-button" onClick={() => app.openView(DOWNLOAD_VIEW)}>
        <Icon name="download" />
        Download
      </button>
    </>
  );
}
