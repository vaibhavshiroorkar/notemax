import { useEffect, useState } from "react";
import { Icon } from "@/ui/Icon";
import { mayOffer, offerAnswered, openDownloadPage, systemWithApp } from "./offer";

// Long enough that the first look at the app comes first, and a quick visit never sees it.
const WAIT_MS = 15_000;

/** A card in the corner of the browser version, once, offering the Windows or Android app. */
export function GetAppCard() {
  const answered = offerAnswered.use();
  const [due, setDue] = useState(false);
  const offer = mayOffer() && !answered;

  useEffect(() => {
    if (!offer) return;
    const timer = setTimeout(() => setDue(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, [offer]);

  if (!offer || !due) return null;
  const android = systemWithApp() === "android";
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
          ? "Put Notemax on your home screen. It opens like any app and works offline."
          : "The Windows app keeps your pages in a file on your PC, works offline, and updates itself."}
      </p>
      <div className="get-app-actions">
        <button
          className="button button-primary"
          onClick={() => {
            offerAnswered.set(true);
            openDownloadPage();
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
