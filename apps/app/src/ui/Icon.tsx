const paths = {
  "chevron-right": "M6 4l4 4-4 4",
  "chevron-down": "M4 6l4 4 4-4",
  plus: "M8 3v10M3 8h10",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5",
  sidebar: "M2.5 3h11v10h-11zM6 3v10",
  "book-panel": "M2.5 3h11v10h-11zM10 3v10",
  restore: "M3.5 6.5A5 5 0 1 1 3 9M3.5 3v3.5H7",
  settings: "M2.5 4.5h11M2.5 11.5h11M6 3v3M10 10v3",
  note: "M4 2.5h5l3 3v8H4zM9 2.5v3h3",
  folder: "M2 4.5V12.5h12V6H7.5L6 4.5z",
  book: "M3.5 12.5v-9a1 1 0 0 1 1-1h8v9h-8a1 1 0 0 0 0 2h8",
  close: "M4 4l8 8M12 4l-8 8",
};

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
