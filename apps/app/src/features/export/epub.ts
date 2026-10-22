import { PAGE_CSS, escapeHtml } from "./serialize";
import { zip, type ZipEntry } from "./zip";

export interface EpubChapter {
  title: string;
  /** Body HTML from toHtml. */
  html: string;
}

export interface EpubImage {
  /** Like "images/1.png", the same path the chapter HTML uses. */
  path: string;
  bytes: Uint8Array;
  type: string;
}

// EPUB pages are XHTML, which needs empty elements closed. Only applied to HTML this app wrote.
const xhtml = (html: string) => html.replace(/<(br|hr|img|input)\b([^>]*?)\/?>/g, "<$1$2/>");

const page = (title: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${body}
</body>
</html>
`;

/** An EPUB 3 book: one page per chapter, a table of contents, and the pictures. */
export function buildEpub(title: string, author: string, chapters: EpubChapter[], images: EpubImage[]): Blob {
  const id = `urn:uuid:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const files = chapters.map((_, i) => `chapter-${i + 1}.xhtml`);

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="en">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">${id}</dc:identifier>
<dc:title>${escapeHtml(title)}</dc:title>
${author ? `<dc:creator>${escapeHtml(author)}</dc:creator>` : ""}
<dc:language>en</dc:language>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
${files.map((file, i) => `<item id="c${i + 1}" href="${file}" media-type="application/xhtml+xml"/>`).join("\n")}
${images.map((image, i) => `<item id="i${i + 1}" href="${image.path}" media-type="${image.type}"/>`).join("\n")}
</manifest>
<spine>
${files.map((_, i) => `<itemref idref="c${i + 1}"/>`).join("\n")}
</spine>
</package>
`;

  const nav = page(
    title,
    `<nav epub:type="toc" id="toc"><h1>${escapeHtml(title)}</h1><ol>
${chapters.map((chapter, i) => `<li><a href="${files[i]}">${escapeHtml(chapter.title)}</a></li>`).join("\n")}
</ol></nav>`,
  );

  const entries: ZipEntry[] = [
    // Must be first and stored, so readers can tell what the file is from its first bytes.
    { path: "mimetype", data: "application/epub+zip" },
    {
      path: "META-INF/container.xml",
      data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`,
    },
    { path: "OEBPS/content.opf", data: opf },
    { path: "OEBPS/nav.xhtml", data: nav },
    { path: "OEBPS/style.css", data: PAGE_CSS.replace(/max-width:42em;margin:2em auto;padding:0 1em;/, "") },
    ...chapters.map((chapter, i) => ({ path: `OEBPS/${files[i]}`, data: page(chapter.title, `<h1>${escapeHtml(chapter.title)}</h1>\n${xhtml(chapter.html)}`) })),
    ...images.map((image) => ({ path: `OEBPS/${image.path}`, data: image.bytes })),
  ];
  return zip(entries, "application/epub+zip");
}
