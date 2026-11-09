import { useEffect, useRef, useState, type ReactNode } from "react";
import { touchFirst } from "./layout";

/**
 * A modal built on <dialog>, which gives focus trapping, Esc to close and a
 * backdrop for free. Rendering it opens it; the parent unmounts it to close.
 */
export function Dialog({
  label,
  onClose,
  className = "",
  children,
}: {
  label: string;
  onClose(): void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // No cleanup that calls close(): React runs effects twice in development, and
  // the queued close event would shut the dialog right after it opened.
  // Unmounting removes it from the page, which closes it anyway.
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
    // showModal moves focus to the first button it finds (often Close). A field
    // marked data-autofocus, like a search box, gets it instead. On a touch
    // screen that would pop the keyboard up over the dialog, so only fields
    // marked "always", where typing is the whole point, get it there.
    const field = ref.current?.querySelector<HTMLElement>("[data-autofocus]");
    const touch = touchFirst();
    if (field && (field.dataset.autofocus === "always" || !touch)) field.focus();
    // On a touch screen nothing needs the keyboard yet, so the dialog itself takes focus,
    // not the Close button, which would show a focus ring nobody asked for.
    else if (touch) ref.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      tabIndex={-1}
      aria-label={label}
      onClose={onClose}
      // A click on the dialog element itself, not its content, is a click on the backdrop.
      onClick={(event) => event.target === ref.current && onClose()}
    >
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  typeToConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
  /** For what cannot be undone: these words must be typed before the button works. */
  typeToConfirm?: string;
}) {
  const [typed, setTyped] = useState("");
  const ready = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.trim().toLowerCase();
  return (
    <Dialog label={title} onClose={onCancel} className="confirm">
      <h2 className="dialog-title">{title}</h2>
      <p className="dialog-message">{message}</p>
      {typeToConfirm && (
        <label className="prompt-field dialog-retype">
          <span>
            Type <strong>{typeToConfirm}</strong> to confirm
          </span>
          <input
            value={typed}
            data-autofocus
            aria-label={`Type ${typeToConfirm} to confirm`}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && ready && onConfirm()}
          />
        </label>
      )}
      <div className="dialog-actions">
        {/* Focus starts on Cancel, so a stray Enter never erases anything. */}
        <button className="button" autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="button button-danger" disabled={!ready} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
