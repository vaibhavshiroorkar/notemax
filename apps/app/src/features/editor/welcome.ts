/** The first note in a new workspace. It is only written into an empty body. */
export const welcomeContent = `
  <p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed in the right sidebar.</p>
`;

/**
 * What the first note said in earlier versions. Signing in on a new device
 * compares the note with these to tell whether someone wrote in it.
 */
export const pastWelcomeContent = [
  `<p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed at the bottom.</p>`,
];
