import { useEffect, useRef, useState, type FormEvent } from "react";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { addressFor, siteOf, VIEW_SEARCH } from "./address";
import { useNativeView, usesNativeView } from "./nativeView";
import "./browser.css";

/** Saved browser pages stay readable on the web; browsing runs in the desktop app. */
export function BrowserPane(props: PageProps) {
  return usesNativeView ? <NativeBrowserPane {...props} /> : <BrowserUnavailable {...props} />;
}

function BrowserUnavailable({ node, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const [address, setAddress] = useState("");
  useEffect(() => onStatus(status), [status, onStatus]);
  useEffect(() => {
    if (!local) return;
    const settings = local.doc.getMap<string>("browser");
    const read = () => setAddress(addressFor(settings.get("url") ?? "") ?? "");
    read();
    onReady();
    settings.observe(read);
    return () => settings.unobserve(read);
  }, [local, onReady]);
  if (openError) return <p className="error">Could not read the saved address: {openError}</p>;
  return <div className="browser-empty">
    <Icon name="globe" />
    <p>Browser pages are available in the desktop app.</p>
    {address && <a className="button" href={address} target="_blank" rel="noopener noreferrer">Open saved site in a new tab</a>}
  </div>;
}

function NativeBrowserPane({ node, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const [address, setAddress] = useState("");
  const [typed, setTyped] = useState("");
  const [refused, setRefused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLInputElement>(null);
  useEffect(() => onStatus(status), [status, onStatus]);

  useEffect(() => {
    if (!local) return;
    const settings = local.doc.getMap<string>("browser");
    const read = () => {
      const url = settings.get("url") ?? "";
      setAddress(url);
      // Not while someone is typing a new one.
      if (document.activeElement !== bar.current) setTyped(url);
    };
    read();
    onReady();
    settings.observe(read);
    return () => settings.unobserve(read);
  }, [local, onReady]);

  const show = (url: string) => {
    if (!local) return;
    local.doc.getMap<string>("browser").set("url", url);
    touchNode(workspaceDoc, node.id);
    // A page with no name takes the site's.
    if (!node.title) renameNode(workspaceDoc, node.id, siteOf(url));
  };

  const view = useNativeView(box, `browser-${node.id}`, address, {
    // Where a link inside the view went, kept as the page's address.
    onVisit: (url) => {
      if (document.activeElement !== bar.current) setTyped(url);
      if (!local || local.doc.getMap<string>("browser").get("url") === url) return;
      local.doc.getMap<string>("browser").set("url", url);
      touchNode(workspaceDoc, node.id);
    },
    onTitle: (title) => {
      if (title && !node.title) renameNode(workspaceDoc, node.id, title);
    },
  });

  const go = (event: FormEvent) => {
    event.preventDefault();
    const url = addressFor(typed, { search: VIEW_SEARCH });
    setRefused(!url && typed.trim() !== "");
    if (!url) return;
    show(url);
    setTyped(url);
    // Out of the bar, so it follows where the page goes from here.
    bar.current?.blur();
  };

  if (openError) return <p className="error">Could not open this page: {openError}</p>;

  return (
    <div className="browser-page">
      <form className="browser-bar" onSubmit={go}>
        <button type="button" className="icon-button" aria-label="Back" disabled={!address} onClick={() => view.step("back")}>
          <Icon name="arrow-left" />
        </button>
        <button type="button" className="icon-button" aria-label="Forward" disabled={!address} onClick={() => view.step("forward")}>
          <Icon name="arrow-right" />
        </button>
        <button type="button" className="icon-button" aria-label="Reload" disabled={!address} onClick={() => view.step("reload")}>
          <Icon name="restore" />
        </button>
        <input
          ref={bar}
          className="browser-address"
          value={typed}
          placeholder="Type an address or search"
          aria-label="Address"
          spellCheck={false}
          autoFocus={!address}
          onChange={(event) => setTyped(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
        <button type="button" className="icon-button" aria-label="Open in a new window" title="Open in a new window" disabled={!address} onClick={() => window.open(address, "_blank", "noopener,noreferrer")}>
          <Icon name="external" />
        </button>
      </form>
      {refused && <p className="browser-note browser-refused">Only web addresses (http and https) open here, and not pages of Notemax itself.</p>}
      {address ? (
        // The web view lies over this box; the box only holds its place.
        <div ref={box} className="browser-frame browser-native" aria-label={node.title || siteOf(address)}>
          <Icon name="globe" />
          <span>{siteOf(address)}</span>
        </div>
      ) : (
        <div className="browser-empty">
          <Icon name="globe" />
          <p>Type an address above, like wikipedia.org, or words to search for.</p>
        </div>
      )}
    </div>
  );
}
