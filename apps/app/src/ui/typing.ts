// Fields, notes, code and boards use keys for themselves: Delete deletes a
// character, Ctrl+Z undoes typing, Option+arrows move by word. The app's own
// keys stand back there.
const OWN_KEYS = "input, textarea, select, [contenteditable='true'], .ProseMirror, .cm-content, .excalidraw";

/** True when a key pressed at this element is for typing, not for the app. */
export const isTypingTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest(OWN_KEYS);
