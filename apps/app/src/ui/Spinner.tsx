import type { ReactNode } from "react";
import "./spinner.css";

/**
 * A turning ring for something on its way. It fades in only after a moment,
 * so a quick load never flashes it.
 */
export function Spinner({ large = false }: { large?: boolean }) {
  return <span className="spinner" data-large={large || undefined} aria-hidden="true" />;
}

/** A place still loading: the ring and a few words, read out once by screen readers. */
export function Loading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`loading ${className}`.trim()} role="status">
      <Spinner />
      <span>{children}</span>
    </p>
  );
}

/** Fills the space it is in with a large ring, for a whole page or pane that is opening. */
export function PaneLoading({ label = "Opening", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`pane-loading ${className}`.trim()} role="status" aria-label={label}>
      <Spinner large />
    </div>
  );
}
