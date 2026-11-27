# Pending work

Open tasks, decisions and follow-ups. When one is done, move it to the
Unreleased section of [CHANGELOG.md](../CHANGELOG.md) in the same commit.

## Waiting on the user

- Update every installed app to 0.123.1: the Windows app (it offers the update
  on start) and the Android app (it shows a notice, or install the APK from the
  site). Reload any open browser tab. Until then a device on 0.122.0 or older
  stops seeing new edits.
- Sign in on one updated device and let it sync once. That moves the Drive
  files into the new folders. Then check the Notemax folder in Drive has
  `workspaces/<id>/pages|history|assets` and `system`.

## Open

- **Background sync on Android (spike).** Branch `spike/background-wake`
  (local only, not pushed). A WorkManager job wakes the app's own sync about
  every 15 minutes while the process is alive. Not measured yet: needs a phone
  or emulator left in the background for over 15 minutes, checking whether
  edits from another device arrive. Decide from that whether to merge, or to
  build a native sync path instead.
- **TeaVM upstream.** teavm.org now serves a different `compiler.wasm` than the
  one in `vendor/teavm/`. Decide whether to test and take the new build. See
  the steps at the top of `scripts/copy-runtimes.mjs`.

## Suggestions (not started)

- Android themed (monochrome) icon for Android 13+ themed icons.
- `docs/SECURITY.md`, now that the app takes outside input from shared text
  and `notemax://` links.
- On a phone, Back closes the open sidebar or menu before leaving the page.
