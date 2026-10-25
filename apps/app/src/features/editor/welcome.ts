import { STARTER } from "@notemax/core";

/** The first note in a new workspace. It is only written into an empty body. */
export const welcomeContent = `
  <p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed in the right sidebar.</p>
  <p>Beside this note in the Notemax folder: <strong>Journal</strong> keeps a note for each day, as subtopics on one page, and <strong>My first book</strong> shows how chapters and subtopics fit together.</p>
`;

/**
 * What the first note said in earlier versions. Signing in on a new device
 * compares the note with these to tell whether someone wrote in it.
 */
export const pastWelcomeContent = [
  `<p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed in the right sidebar.</p>
  <p>Beside this note: <strong>Journal</strong> holds a note for each day you open from the calendar, <strong>Drawing board</strong> is for sketches, and <strong>My first book</strong> shows how chapters and subtopics fit together.</p>`,
  `<p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed at the bottom.</p>`,
  `<p>This is your first note. Use <strong>+</strong> in the sidebar to add notes, folders and books, and drag them to sort.</p>
  <p>Everything is saved on this device. Type <code>/</code> at the start of a line for headings, lists, to-dos and more.</p>
  <p>Type <code>[[</code> to link to another note. Notes that link here are listed in the right sidebar.</p>`,
];

/**
 * What each starter page says before anyone writes in it, by page id. The
 * book's own entry is its description. Written only into an empty body.
 */
export const starterContent: Record<string, string> = {
  [STARTER.welcome]: welcomeContent,
  [STARTER.book]: `<p>A book is something you write from start to end. Its chapters are listed below, and the right sidebar lists them too. Switch to <strong>Full text</strong> to read and write it all on one page.</p>`,
  [STARTER.chapter]: `<p>This is chapter 1. Write here, then press <strong>Add subtopic</strong> at the end to add 1.2, 1.3 and so on. They stay inside this chapter, and the right sidebar jumps to each one.</p>`,
  [STARTER.subtopic]: `<p>This is subtopic 1.1. Its ... menu can move it, make it a chapter of its own, or delete it.</p>`,
};

/** What starter pages other than Welcome said in earlier versions. */
const pastStarterContent: Record<string, string[]> = {
  [STARTER.book]: [
    `<p>A book is something you write from start to end. Its chapters are listed below, and the right sidebar lists them too. Switch to <strong>Whole book</strong> to read and write it all on one page.</p>`,
  ],
};

/** Every text a starter page has come with, so a device can tell whether someone wrote in it. */
export const starterSeeds = (id: string): string[] =>
  id === STARTER.welcome ? [welcomeContent, ...pastWelcomeContent] : starterContent[id] ? [starterContent[id], ...(pastStarterContent[id] ?? [])] : [];
