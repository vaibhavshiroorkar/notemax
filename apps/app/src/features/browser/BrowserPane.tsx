import { useEffect, useRef, useState, type FormEvent } from "react";
import { renameNode, touchNode } from "@notemax/core";
import { useLocalDoc } from "@/data/useLocalDoc";
import type { PageProps } from "@/plugins/types";
import { Icon } from "@/ui/Icon";
import { addressFor, forFrame, siteOf, VIEW_SEARCH } from "./address";
import { useNativeView, usesNativeView } from "./nativeView";
import "./browser.css";

/**
 * A web page inside a page, with its own address bar. The address syncs with
 * the page, so it opens at the same place on every device. On the web it is a
 * frame, and Back and Forward step through the addresses typed here. In the
 * desktop app it is a real web view, so sites that refuse frames open too,
 * links that would open a new window stay in it, and Back and Forward are the
 * view's own.
 */
export function BrowserPane({ node, workspaceDoc, onStatus, onReady }: PageProps) {
  const { local, status, openError } = useLocalDoc(node.id);
  const [address, setAddress] = useState("");
  const [typed, setTyped] = useState("");
  const [refused, setRefused] = useState(false);
  const [trail, setTrail] = useState<{ list: string[]; at: number }>({ list: [], at: -1 });
  const [reloads, setReloads] = useState(0);
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
      setTrail((t) => (t.list[t.at] === url || !url ? t : { list: [...t.list.slice(0, t.at + 1), url], at: t.at + 1 }));
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
    const url = addressFor(typed, { search: usesNativeView ? VIEW_SEARCH : undefined });
    setRefused(!url && typed.trim() !== "");
    if (!url) return;
    show(url);
    setTyped(url);
    // Out of the bar, so it follows where the page goes from here.
    bar.current?.blur();
  };

  const step = (by: -1 | 1) => {
    if (usesNativeView) return view.step(by < 0 ? "back" : "forward");
    const at = trail.at + by;
    if (at < 0 || at >= trail.list.length) return;
    setTrail({ ...trail, at });
    local?.doc.getMap<string>("browser").set("url", trail.list[at]);
  };

  if (openError) return <p className="error">Could not open this page: {openError}</p>;

  return (
    <div className="browser-page">
      <form className="browser-bar" onSubmit={go}>
        <button type="button" className="icon-button" aria-label="Back" disabled={usesNativeView ? !address : trail.at <= 0} onClick={() => step(-1)}>
          <Icon name="arrow-left" />
        </button>
        <button type="button" className="icon-button" aria-label="Forward" disabled={usesNativeView ? !address : trail.at >= trail.list.length - 1} onClick={() => step(1)}>
          <Icon name="arrow-right" />
        </button>
        <button type="button" className="icon-button" aria-label="Reload" disabled={!address} onClick={() => (usesNativeView ? view.step("reload") : setReloads((n) => n + 1))}>
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
      {address && usesNativeView ? (
        // The web view lies over this box; the box only holds its place.
        <div ref={box} className="browser-frame browser-native" aria-label={node.title || siteOf(address)}>
          <Icon name="globe" />
          <span>{siteOf(address)}</span>
        </div>
      ) : address ? (
        <>
          <iframe
            key={`${address}:${reloads}`}
            className="browser-frame"
            src={forFrame(address)}
            title={node.title || siteOf(address)}
            // Its own site, scripts and forms; never this app's.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
            referrerPolicy="no-referrer"
            allow="clipboard-write; fullscreen"
          />
          <p className="browser-note">Some sites refuse to show inside other pages. If this one stays blank, open it in a new window.</p>
        </>
      ) : (
        <div className="browser-empty">
          <Icon name="globe" />
          <p>Type an address above, like wikipedia.org, or words to search for.</p>
        </div>
      )}
    </div>
  );
}
