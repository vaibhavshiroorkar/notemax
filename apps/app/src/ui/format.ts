/** "1 page", "1,204 pages". Words that add an s only. */
export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** What went wrong, in words, from anything thrown. */
export const messageOf = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));
