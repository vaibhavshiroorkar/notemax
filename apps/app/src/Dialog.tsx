import { useEffect, useRef, type ReactNode } from "react";

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
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
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
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
}) {
  return (
    <Dialog label={title} onClose={onCancel} className="confirm">
      <h2 className="dialog-title">{title}</h2>
      <p className="dialog-message">{message}</p>
      <div className="dialog-actions">
        {/* Focus starts on Cancel, so a stray Enter never erases anything. */}
        <button className="button" autoFocus onClick={onCancel}>
          Cancel
        </button>
        <button className="button button-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
