import { useSyncExternalStore } from "react";
import { getPref, onPrefChangedElsewhere, setPref } from "./prefs";

export interface Store<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
  /** A React hook: the current value, re-rendering when it changes. */
  use(): T;
}

/** A value outside React that any component can watch. */
export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  const store: Store<T> = {
    get: () => value,
    set(next) {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    use: () => useSyncExternalStore(store.subscribe, store.get),
  };
  return store;
}

/**
 * Watches one piece of a store. The component redraws only when that piece
 * changes, so a thousand sidebar rows can each watch "am I the open page?" and
 * only the two rows whose answer flips redraw.
 */
export function useSelect<T, R>(store: Store<T>, select: (value: T) => R): R {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}

/**
 * A store kept in prefs, so it survives restarts and other windows follow its
 * changes. `decode` gets the saved text and should throw or return the fallback
 * on anything it does not recognize, since prefs can hold values from older versions.
 */
export function savedStore<T>(
  key: string,
  fallback: T,
  { decode = (raw) => JSON.parse(raw) as T, encode = (value) => JSON.stringify(value) }: { decode?(raw: string): T; encode?(value: T): string } = {},
): Store<T> {
  const read = (): T => {
    const raw = getPref(key);
    if (raw === null) return fallback;
    try {
      return decode(raw);
    } catch {
      return fallback;
    }
  };
  const store = createStore(read());
  const set = store.set;
  store.set = (next) => {
    setPref(key, encode(next));
    set(next);
  };
  onPrefChangedElsewhere(key, () => set(read()));
  return store;
}
