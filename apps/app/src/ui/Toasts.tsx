import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { dismissToast, toasts, type Toast } from "./toast";
import "./toast.css";

// Long enough to read the message and reach for Undo.
const SHOW_MS = 6000;

export function Toasts() {
  const list = toasts.use();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((toast) => (
        <ToastView key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastView({ toast }: { toast: Toast }) {
  // The timer waits while the pointer or focus is on the toast, so it never
  // disappears under someone about to click Undo.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const timer = setTimeout(() => dismissToast(toast.id), SHOW_MS);
    return () => clearTimeout(timer);
  }, [held, toast.id]);

  return (
    <div
      className="toast"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-action"
          onClick={() => {
            toast.action!.run();
            dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="icon-button toast-close" aria-label="Dismiss" title="Dismiss" onClick={() => dismissToast(toast.id)}>
        <Icon name="close" />
      </button>
    </div>
  );
}
