import { useState } from "react";
import { createStore } from "@/platform/store";
import { Dialog } from "./Dialog";

interface Ask {
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  confirm: string;
  done(value: string | null): void;
}

const asking = createStore<Ask | null>(null);

/**
 * Asks for one line of text, like a link address or a picture's description.
 * Resolves to null on Cancel. The browser's own prompt() would freeze the app
 * (and the desktop app has none), so this is a small dialog instead.
 */
export function askText(options: Omit<Ask, "done" | "value" | "confirm"> & { value?: string; confirm?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    asking.get()?.done(null);
    asking.set({ value: "", confirm: "OK", ...options, done: resolve });
  });
}

/** Rendered once, by the app. */
export function PromptHost() {
  const ask = asking.use();
  if (!ask) return null;
  return <PromptDialog key={ask.title + ask.label} ask={ask} />;
}

function PromptDialog({ ask }: { ask: Ask }) {
  const [value, setValue] = useState(ask.value);
  const finish = (result: string | null) => {
    asking.set(null);
    ask.done(result);
  };
  return (
    <Dialog label={ask.title} onClose={() => finish(null)} className="confirm prompt">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          finish(value);
        }}
      >
        <h2 className="dialog-title">{ask.title}</h2>
        <label className="prompt-field">
          <span>{ask.label}</span>
          <input data-autofocus="always" value={value} placeholder={ask.placeholder} onChange={(event) => setValue(event.target.value)} onFocus={(event) => event.target.select()} />
        </label>
        <div className="dialog-actions">
          <button type="button" className="button" onClick={() => finish(null)}>
            Cancel
          </button>
          <button type="submit" className="button button-primary">
            {ask.confirm}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
