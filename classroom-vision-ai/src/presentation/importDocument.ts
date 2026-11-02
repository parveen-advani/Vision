import type JSZipTypes from "jszip";

export const MAX_CONTEXT_CHARACTERS = 12_000;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENT_SECTIONS = 100;
const MAX_ZIP_ENTRIES = 5_000;
const MAX_ZIP_EXPANDED_BYTES = 80 * 1024 * 1024;
const MAX_XML_BYTES = 2 * 1024 * 1024;

export interface ImportedDocument {
  name: string;
  text: string;
  format: "text" | "pptx" | "pdf";
  sectionCount: number;
  sectionsRead: number;
  truncated: boolean;
  warnings: string[];
}

interface ImportOptions {
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException("Import cancelled.", "AbortError");
}

function trimContext(text: string) {
  let end = MAX_CONTEXT_CHARACTERS;
  const last = text.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return text.slice(0, end).trim();
}

function result(
  file: File,
  format: ImportedDocument["format"],
  text: string,
  sectionCount: number,
  sectionsRead: number,
  warnings: string[] = [],
): ImportedDocument {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (!cleaned) {
    throw new Error(
      format === "pdf"
        ? "No readable text was found. This PDF may contain scanned images. Use a text-based PDF or paste your notes."
        : "No readable text was found. Try another document or paste your notes.",
    );
  }
  const truncated =
    cleaned.length > MAX_CONTEXT_CHARACTERS || sectionsRead < sectionCount;
  if (cleaned.length > MAX_CONTEXT_CHARACTERS) {
    warnings.push(
      "Only the first 12,000 characters are included. Review the preview and keep the parts that matter for this session.",
    );
  }
  if (sectionsRead < sectionCount) {
    warnings.push(
      `Read ${sectionsRead} of ${sectionCount} ${format === "pptx" ? "slides" : "pages"} before reaching the import limit.`,
    );
  }
  return {
    name: file.name,
    format,
    text: trimContext(cleaned),
    sectionCount,
    sectionsRead,
    truncated,
    warnings,
  };
}

// Check the ZIP directory before a library expands any entry. These limits also
// cover media entries that are not needed for extracting presentation text.
function inspectZip(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (
    let offset = buffer.byteLength - 22;
    offset >= Math.max(0, buffer.byteLength - 65_557);
    offset -= 1
  ) {
    if (
      view.getUint32(offset, true) === 0x06054b50 &&
      offset + 22 + view.getUint16(offset + 20, true) === buffer.byteLength
    ) {
      end = offset;
      break;
    }
  }
  if (end < 0)
    throw new Error(
      "This file is not a readable PPTX. Save it as a new .pptx file and try again.",
    );
  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    throw new Error(
      "This presentation uses an unsupported archive format. Export a smaller PPTX or a PDF.",
    );
  }
  if (count > MAX_ZIP_ENTRIES || directoryOffset + directorySize > end) {
    throw new Error(
      "This presentation has too many embedded items or an invalid archive. Export a simpler PPTX or a PDF.",
    );
  }
  let cursor = directoryOffset;
  let expanded = 0;
  const sizes = new Map<string, number>();
  const decoder = new TextDecoder();
  for (let index = 0; index < count; index += 1) {
    if (
      cursor + 46 > directoryOffset + directorySize ||
      view.getUint32(cursor, true) !== 0x02014b50
    )
      throw new Error("The presentation archive is damaged.");
    const flags = view.getUint16(cursor + 8, true);
    const compressed = view.getUint32(cursor + 20, true);
    const uncompressed = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    if (entryEnd > directoryOffset + directorySize)
      throw new Error("The presentation archive is damaged.");
    if (flags & 1)
      throw new Error(
        "Password-protected presentations are not supported. Use an unlocked copy.",
      );
    if (compressed === 0xffffffff || uncompressed === 0xffffffff)
      throw new Error(
        "This presentation is too large to import in the browser.",
      );
    expanded += uncompressed;
    if (
      expanded > MAX_ZIP_EXPANDED_BYTES ||
      (uncompressed > 1024 * 1024 &&
        uncompressed / Math.max(1, compressed) > 200)
    ) {
      throw new Error(
        "This presentation expands beyond the import limit. Export a smaller PPTX or a text-based PDF.",
      );
    }
    const name = decoder.decode(
      new Uint8Array(buffer, cursor + 46, nameLength),
    );
    if (sizes.has(name))
      throw new Error(
        "The presentation contains duplicate archive entries. Save a fresh copy and try again.",
      );
    sizes.set(name, uncompressed);
    cursor = entryEnd;
  }
  return sizes;
}

function xmlDocument(text: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error("This presentation contains unsupported XML declarations.");
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length)
    throw new Error(
      "Some presentation text could not be read. Save a new PPTX and try again.",
    );
  return xml;
}

function elements(node: Document | Element, localName: string) {
  return Array.from(node.getElementsByTagName("*")).filter(
    (element) => element.localName === localName,
  );
}

function textParagraphs(xml: Document) {
  return elements(xml, "p")
    .filter((paragraph) => {
      let shape = paragraph.parentElement;
      while (shape && shape.localName !== "sp") shape = shape.parentElement;
      const placeholder = shape && elements(shape, "ph")[0];
      return (
        !placeholder ||
        !["sldNum", "dt", "ftr", "hdr"].includes(
          placeholder.getAttribute("type") ?? "",
        )
      );
    })
    .map((paragraph) =>
      elements(paragraph, "t")
        .map((text) => text.textContent ?? "")
        .join("")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function packagePath(baseFile: string, target: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.includes("\\"))
    throw new Error("The presentation contains an unsupported document link.");
  const pieces = target.startsWith("/") ? [] : baseFile.split("/").slice(0, -1);
  let decoded: string;
  try {
    decoded = decodeURIComponent(target.split("#")[0]);
  } catch {
    throw new Error("The presentation contains an invalid document link.");
  }
  for (const part of decoded.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!pieces.length)
        throw new Error("The presentation contains an invalid document path.");
      pieces.pop();
    } else pieces.push(part);
  }
  return pieces.join("/");
}

async function importPptx(file: File, options: ImportOptions) {
  options.onProgress?.("Reading presentation structure…");
  const buffer = await file.arrayBuffer();
  checkCancelled(options.signal);
  const sizes = inspectZip(buffer);
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const readXml = async (path: string) => {
    checkCancelled(options.signal);
    const entry = zip.file(path);
    if (!entry)
      throw new Error(
        "A required part of this presentation is missing. Save a fresh copy and try again.",
      );
    if ((sizes.get(path) ?? Infinity) > MAX_XML_BYTES)
      throw new Error(
        "A slide contains too much embedded text. Export a simpler presentation.",
      );
    const xml = await new Promise<string>((resolve, reject) => {
      // JSZip documents this API, but its bundled ZipObject type omits it.
      const stream = (
        entry as typeof entry & {
          internalStream(type: "string"): JSZipTypes.JSZipStreamHelper<string>;
        }
      ).internalStream("string");
      const chunks: string[] = [];
      let length = 0;
      const cancel = () => {
        stream.pause();
        reject(new DOMException("Import cancelled.", "AbortError"));
      };
      options.signal?.addEventListener("abort", cancel, { once: true });
      stream
        .on("data", (chunk) => {
          length += chunk.length;
          if (length > MAX_XML_BYTES) {
            stream.pause();
            options.signal?.removeEventListener("abort", cancel);
            reject(new Error("A slide exceeds the import limit."));
          } else chunks.push(chunk);
        })
        .on("error", (error) => {
          options.signal?.removeEventListener("abort", cancel);
          reject(error);
        })
        .on("end", () => {
          options.signal?.removeEventListener("abort", cancel);
          resolve(chunks.join(""));
        })
        .resume();
    });
    checkCancelled(options.signal);
    return xmlDocument(xml);
  };
  const presentation = await readXml("ppt/presentation.xml");
  const relationships = await readXml("ppt/_rels/presentation.xml.rels");
  const relationshipMap = new Map(
    elements(relationships, "Relationship")
      .filter((rel) => rel.getAttribute("TargetMode") !== "External")
      .map((rel) => [rel.getAttribute("Id"), rel.getAttribute("Target") ?? ""]),
  );
  const slides = elements(presentation, "sldId");
  if (!slides.length)
    throw new Error("This presentation has no slides to import.");
  const sections: string[] = [];
  let length = 0;
  let read = 0;
  for (const slide of slides.slice(0, MAX_DOCUMENT_SECTIONS)) {
    checkCancelled(options.signal);
    const relationshipId = Array.from(slide.attributes).find(
      (attribute) => attribute.localName === "id" && attribute.namespaceURI,
    )?.value;
    const target = relationshipMap.get(relationshipId ?? "");
    if (!target)
      throw new Error(
        "A slide reference is missing from this presentation. Save a fresh copy and try again.",
      );
    const slidePath = packagePath("ppt/presentation.xml", target);
    options.onProgress?.(
      `Reading slide ${read + 1} of ${Math.min(slides.length, MAX_DOCUMENT_SECTIONS)}…`,
    );
    const slideText = textParagraphs(await readXml(slidePath));
    let notesText = "";
    const slideParts = slidePath.split("/");
    const slideName = slideParts.pop();
    const slideRels = [...slideParts, "_rels", `${slideName}.rels`].join("/");
    if (zip.file(slideRels)) {
      const notesRel = elements(await readXml(slideRels), "Relationship").find(
        (rel) =>
          rel.getAttribute("Type")?.endsWith("/notesSlide") &&
          rel.getAttribute("TargetMode") !== "External",
      );
      const notesTarget = notesRel?.getAttribute("Target");
      if (notesTarget)
        notesText = textParagraphs(
          await readXml(packagePath(slidePath, notesTarget)),
        );
    }
    read += 1;
    if (slideText || notesText) {
      const section = `[Slide ${read}]\n${slideText}${notesText ? `\n[Speaker notes]\n${notesText}` : ""}`;
      sections.push(section);
      length += section.length + 2;
    }
    if (length > MAX_CONTEXT_CHARACTERS) break;
  }
  return result(file, "pptx", sections.join("\n\n"), slides.length, read, [
    "Text and speaker notes are imported. Images, charts, animations, and the original slide layout are not included.",
  ]);
}

async function importPdf(file: File, options: ImportOptions) {
  options.onProgress?.("Opening PDF…");
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  checkCancelled(options.signal);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  let passwordRequired = false;
  task.onPassword = () => {
    passwordRequired = true;
    void task.destroy();
  };
  const cancel = () => {
    void task.destroy();
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  try {
    checkCancelled(options.signal);
    const document = await task.promise;
    const sections: string[] = [];
    let length = 0;
    let read = 0;
    let emptyPages = 0;
    for (
      let pageNumber = 1;
      pageNumber <= Math.min(document.numPages, MAX_DOCUMENT_SECTIONS);
      pageNumber += 1
    ) {
      checkCancelled(options.signal);
      options.onProgress?.(
        `Reading page ${pageNumber} of ${Math.min(document.numPages, MAX_DOCUMENT_SECTIONS)}…`,
      );
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
        )
        .join("")
        .trim();
      page.cleanup();
      read += 1;
      if (text) {
        const section = `[Page ${pageNumber}]\n${text}`;
        sections.push(section);
        length += section.length + 2;
      } else emptyPages += 1;
      if (length > MAX_CONTEXT_CHARACTERS) break;
    }
    const warnings = [
      "Text is imported in reading order where available. Images, diagrams, and original page layout are not included.",
    ];
    if (emptyPages)
      warnings.push(
        `${emptyPages} ${emptyPages === 1 ? "page had" : "pages had"} no readable text; scanned images are not transcribed.`,
      );
    return result(
      file,
      "pdf",
      sections.join("\n\n"),
      document.numPages,
      read,
      warnings,
    );
  } catch (error) {
    checkCancelled(options.signal);
    if (passwordRequired)
      throw new Error(
        "This PDF is password-protected. Use an unlocked copy or paste your notes.",
      );
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", cancel);
    await task.destroy();
  }
}

export async function importDocument(
  file: File,
  options: ImportOptions = {},
): Promise<ImportedDocument> {
  checkCancelled(options.signal);
  if (!file.size)
    throw new Error("This file is empty. Choose another document.");
  if (file.size > MAX_DOCUMENT_BYTES)
    throw new Error("Choose a file smaller than 20 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  try {
    if (extension === "pptx") return await importPptx(file, options);
    if (extension === "pdf") return await importPdf(file, options);
    if (extension === "txt" || extension === "md") {
      options.onProgress?.("Reading your notes…");
      const text = await file.text();
      checkCancelled(options.signal);
      if (text.includes("\u0000"))
        throw new Error(
          "This file is not UTF-8 text. Save it as UTF-8, or paste your notes.",
        );
      return result(file, "text", text, 1, 1);
    }
    throw new Error(
      "Choose a .pptx, .pdf, .txt, or .md file. Older .ppt files need to be saved as .pptx first.",
    );
  } catch (error) {
    checkCancelled(options.signal);
    if (error instanceof Error) throw error;
    throw new Error(
      "This document could not be read. Try another file or paste your notes.",
    );
  }
}
