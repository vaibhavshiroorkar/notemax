import type { DocNode, Resolve } from "./serialize";
import { blockStyleDocx, firstFont, hexOf, textStyleOf } from "./styles";
import { zip, type ZipEntry } from "./zip";

/** A picture ready for Word: PNG, JPEG or GIF bytes and its size in pixels. */
export interface DocxImage {
  bytes: Uint8Array;
  ext: "png" | "jpeg" | "gif";
  width: number;
  height: number;
}

export interface DocxPart {
  /** A chapter title, written as Heading 1 on a new page. */
  title?: string;
  nodes: DocNode[];
}

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const str = (value: unknown) => (typeof value === "string" ? value : "");

// 6.5 inches of text width on a Letter or A4 page with 1 inch margins, in EMU.
const TEXT_WIDTH_EMU = 5943600;
const EMU_PER_PX = 9525;

const BOX = "\u2610";
const CHECKED_BOX = "\u2611";

/**
 * Writes a Word document by hand: the parts Word needs and nothing else.
 * Styles use Word's own names (Title, Heading1, Quote), so the document's
 * outline and table of contents work in Word.
 */
export function buildDocx(title: string, parts: DocxPart[], r: Resolve & { picture(asset: string): DocxImage | null }): Blob {
  const rels: string[] = [
    '<Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
  ];
  const media: ZipEntry[] = [];
  const mediaIds = new Map<string, string>();
  const nums: string[] = [];
  let nextNum = 2;
  let nextLink = 1;
  let nextPic = 1;
  // Word wants every drawing to have its own id, even the same picture twice.
  let nextDrawing = 1;

  const run = (text: string, marks: DocNode["marks"] = []) => {
    const props: string[] = [];
    for (const mark of marks) {
      if (mark.type === "bold") props.push("<w:b/>");
      else if (mark.type === "italic") props.push("<w:i/>");
      else if (mark.type === "strike") props.push("<w:strike/>");
      else if (mark.type === "underline") props.push('<w:u w:val="single"/>');
      else if (mark.type === "highlight") {
        const fill = hexOf(str(mark.attrs?.color));
        props.push(fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '<w:highlight w:val="yellow"/>');
      } else if (mark.type === "textStyle") {
        const { color, size, font } = textStyleOf([mark]);
        if (font) props.push(`<w:rFonts w:ascii="${esc(firstFont(font))}" w:hAnsi="${esc(firstFont(font))}" w:cs="${esc(firstFont(font))}"/>`);
        const hex = color && hexOf(color);
        if (hex) props.push(`<w:color w:val="${hex}"/>`);
        // Half-points: a pixel is three quarters of a point.
        if (size) props.push(`<w:sz w:val="${Math.round(size * 1.5)}"/>`);
      }
      else if (mark.type === "code") props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>');
    }
    const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
    return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
  };

  const inline = (node: DocNode): string =>
    (node.content ?? [])
      .map((child) => {
        if (child.type === "hardBreak") return "<w:r><w:br/></w:r>";
        if (child.type === "wikiLink") return run(r.title(str(child.attrs?.targetId)) ?? str(child.attrs?.label));
        if (child.type !== "text") return inline(child);
        const link = child.marks?.find((m) => m.type === "link");
        const text = run(child.text ?? "", child.marks);
        if (!link) return text;
        const id = `rLink${nextLink++}`;
        rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(str(link.attrs?.href))}" TargetMode="External"/>`);
        return `<w:hyperlink r:id="${id}">${text.replace("<w:r>", '<w:r><w:rPr><w:rStyle w:val="Hyperlink"/></w:rPr>').replace("</w:rPr><w:rPr>", "")}</w:hyperlink>`;
      })
      .join("");

  const para = (content: string, style?: string, extra = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${content}</w:p>`;

  const picture = (node: DocNode): string => {
    const asset = str(node.attrs?.asset);
    const pic = r.picture(asset);
    if (!pic) return "";
    let rid = mediaIds.get(asset);
    if (!rid) {
      rid = `rPic${nextPic}`;
      const file = `media/image${nextPic}.${pic.ext}`;
      nextPic++;
      mediaIds.set(asset, rid);
      media.push({ path: `word/${file}`, data: pic.bytes });
      rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${file}"/>`);
    }
    const percent = Number(node.attrs?.width) || 0;
    const natural = pic.width * EMU_PER_PX;
    const cx = Math.round(Math.min(TEXT_WIDTH_EMU, percent ? (TEXT_WIDTH_EMU * percent) / 100 : natural));
    const cy = Math.round((cx * pic.height) / Math.max(1, pic.width));
    const n = nextDrawing++;
    const alt = esc(str(node.attrs?.alt));
    const align = { left: "left", right: "right" }[str(node.attrs?.align)] ?? "center";
    return para(
      `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Picture ${n}" descr="${alt}"/>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="Picture ${n}" descr="${alt}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
        `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,
      undefined,
      `<w:jc w:val="${align}"/>`,
    );
  };

  const blocks = (nodes: DocNode[], level = 0, quote = false): string =>
    nodes
      .map((node) => {
        switch (node.type) {
          case "heading":
            return para(inline(node), `Heading${Math.min(3, Number(node.attrs?.level ?? 1))}`, blockStyleDocx(node));
          case "paragraph":
            return para(inline(node), quote ? "Quote" : undefined, blockStyleDocx(node));
          case "bulletList":
          case "orderedList":
          case "taskList": {
            let num = 1;
            if (node.type === "orderedList") {
              num = nextNum++;
              nums.push(`<w:num w:numId="${num}"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="${Number(node.attrs?.start ?? 1)}"/></w:lvlOverride></w:num>`);
            }
            return (node.content ?? [])
              .map((item) =>
                (item.content ?? [])
                  .map((child, i) => {
                    if (child.type !== "paragraph") return blocks([child], level + 1, quote);
                    if (node.type === "taskList") {
                      const box = item.attrs?.checked ? CHECKED_BOX : BOX;
                      return para(run(`${box} `) + inline(child), "ListParagraph", `<w:ind w:left="${360 * (level + 1)}"/>`);
                    }
                    if (i > 0) return para(inline(child), "ListParagraph", `<w:ind w:left="${720 * (level + 1)}"/>`);
                    return para(inline(child), "ListParagraph", `<w:numPr><w:ilvl w:val="${Math.min(level, 8)}"/><w:numId w:val="${num}"/></w:numPr>`);
                  })
                  .join(""),
              )
              .join("");
          }
          case "blockquote":
            return blocks(node.content ?? [], level, true);
          case "codeBlock": {
            const lines = (node.content ?? []).map((c) => c.text ?? "").join("").split("\n");
            return lines.map((line) => para(run(line, [{ type: "code" }]), "Code")).join("");
          }
          case "horizontalRule":
            return para("", undefined, '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="999999"/></w:pBdr>');
          case "image":
            return picture(node);
          case "video":
            return para(run(`[Video: ${typeof node.attrs?.name === "string" && node.attrs.name ? node.attrs.name : "video"}]`));
          default:
            return blocks(node.content ?? [], level, quote);
        }
      })
      .join("");

  const body = [
    title ? para(run(title), "Title") : "",
    ...parts.map((part, i) => (part.title ? para(`${i > 0 || title ? '<w:r><w:br w:type="page"/></w:r>' : ""}${run(part.title)}`, "Heading1") : "") + blocks(part.nodes)),
  ].join("");

  const document =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
    `<w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const level = (i: number, format: string, text: string) =>
    `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
  const numbering =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:abstractNum w:abstractNumId="0">${Array.from({ length: 9 }, (_, i) => level(i, "bullet", ["\u2022", "\u25e6", "\u25aa"][i % 3])).join("")}</w:abstractNum>` +
    `<w:abstractNum w:abstractNumId="1">${Array.from({ length: 9 }, (_, i) => level(i, ["decimal", "lowerLetter", "lowerRoman"][i % 3], `%${i + 1}.`)).join("")}</w:abstractNum>` +
    `<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>${nums.join("")}</w:numbering>`;

  const style = (id: string, name: string, props: string, run = "", basedOn = "Normal") =>
    `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${basedOn}"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${props}</w:pPr><w:rPr>${run}</w:rPr></w:style>`;
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:cs="Georgia"/><w:sz w:val="24"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    style("Title", "Title", '<w:spacing w:after="480"/><w:jc w:val="center"/>', '<w:b/><w:sz w:val="56"/>') +
    style("Heading1", "heading 1", '<w:keepNext/><w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="40"/>') +
    style("Heading2", "heading 2", '<w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="1"/>', '<w:b/><w:sz w:val="32"/>') +
    style("Heading3", "heading 3", '<w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="2"/>', '<w:b/><w:sz w:val="28"/>') +
    style("Quote", "Quote", '<w:ind w:left="720"/>', '<w:i/><w:color w:val="555555"/>') +
    style("Code", "Code", '<w:spacing w:after="0"/>', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/>') +
    style("ListParagraph", "List Paragraph", '<w:spacing w:after="60"/>') +
    '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
    "</w:styles>";

  return zip(
    [
      {
        path: "[Content_Types].xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
          '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/>' +
          '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
          '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
          '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
      },
      {
        path: "_rels/.rels",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
          '<Relationship Id="rCore" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
      },
      {
        path: "docProps/core.xml",
        data:
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
          `<dc:title>${esc(title || parts[0]?.title || "Untitled")}</dc:title></cp:coreProperties>`,
      },
      { path: "word/document.xml", data: document },
      { path: "word/styles.xml", data: styles },
      { path: "word/numbering.xml", data: numbering },
      {
        path: "word/_rels/document.xml.rels",
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`,
      },
      ...media,
    ],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}
