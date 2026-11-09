/** Settings only explain the shortcut. The desktop shell registers it. */
export function CaptureSection() {
  return (
    <>
      <div className="settings-row">
        <span>Quick note from any app</span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd>
        </span>
      </div>
    </>
  );
}
