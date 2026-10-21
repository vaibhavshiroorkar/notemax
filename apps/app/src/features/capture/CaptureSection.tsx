/** Settings only explain the shortcut. The desktop shell registers it. */
export function CaptureSection() {
  return (
    <section className="settings-section">
      <h3>Quick capture</h3>
      <p>
        Press <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> in any app to write a quick note. It is added to your notes.
      </p>
    </section>
  );
}
