// Minimal zero-dependency .xlsx reader/writer.
//
// npm install is unreliable from this VM (registry ECONNRESET), so this
// file implements just enough of the format for the alumni Excel import:
// read the first worksheet of a user-supplied .xlsx, and write the import
// template. It uses only Node built-ins (zlib + Buffer).
//
// Format notes: an .xlsx is a ZIP of XML parts. Strings live in
// xl/sharedStrings.xml and cells reference them by index (t="s"); numbers
// are inline in <v>. The writer stores entries uncompressed (method 0);
// the reader accepts stored (0) and deflated (8) entries.

import zlib from "zlib";

export interface DataValidation {
  /** Cell range the dropdown applies to, e.g. "B2:B1001". */
  sqref: string;
  /** Inline list (quotes included), e.g. '"ရဟန်း,လူ"', or a range on
      another sheet, e.g. "Lists!$A$2:$A$13". */
  formula1: string;
}

export interface MiniSheet {
  name: string;
  rows: Array<Array<string | number>>;
  /** Column widths in characters, e.g. [22, 12, 30]. */
  widths?: number[];
  /** Hidden helper sheet (e.g. dropdown lists) — not shown in Excel. */
  hidden?: boolean;
  /** Dropdown (list) validations applied to this sheet. Invalid entries
      show a warning but are not blocked — the import preview is the
      real gate, so a legitimate value outside the list can still be
      typed. */
  validations?: DataValidation[];
}

// ---------------------------------------------------------------------------
// CRC32 (needed for ZIP headers)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlUnescape(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function colLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

// ---------------------------------------------------------------------------
// ZIP: store entries uncompressed (writer) / read stored + deflated (reader)
// ---------------------------------------------------------------------------

interface ZipEntry {
  path: string;
  method: number;
  data: Buffer;
}

function zipStore(files: Array<{ path: string; data: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.path, "utf8");
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 filenames
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18); // compressed size
    local.writeUInt32LE(file.data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    localParts.push(local, nameBuf, file.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8); // flags: UTF-8
    central.writeUInt16LE(0, 10); // method: stored
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attributes
    central.writeUInt32LE(0, 38); // external attributes
    central.writeUInt32LE(offset, 42); // local header offset
    centralParts.push(central, nameBuf);

    offset += 30 + nameBuf.length + file.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central directory
  end.writeUInt16LE(files.length, 8); // entries on this disk
  end.writeUInt16LE(files.length, 10); // total entries
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDir, end]);
}

function zipRead(buffer: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buffer.readUInt16LE(offset + 8);
    const compSize = buffer.readUInt32LE(offset + 18);
    const nameLen = buffer.readUInt16LE(offset + 26);
    const extraLen = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString("utf8", offset + 30, offset + 30 + nameLen);
    const dataStart = offset + 30 + nameLen + extraLen;
    const raw = buffer.subarray(dataStart, dataStart + compSize);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else if (method === 8) {
      data = zlib.inflateRawSync(raw);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }
    out.set(name, data);
    offset = dataStart + compSize;
  }
  if (out.size === 0) {
    throw new Error("Not a valid .xlsx file (no ZIP entries found).");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Writer
// ---------------------------------------------------------------------------

export function buildXlsx(sheets: MiniSheet[]): Buffer {
  const sharedStrings: string[] = [];
  const stringIndex = new Map<string, number>();
  const sharedIndex = (s: string): number => {
    const existing = stringIndex.get(s);
    if (existing !== undefined) return existing;
    const idx = sharedStrings.length;
    sharedStrings.push(s);
    stringIndex.set(s, idx);
    return idx;
  };

  const sheetXmls = sheets.map((sheet) => {
    const cols = sheet.widths
      ? `<cols>${sheet.widths
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join("")}</cols>`
      : "";
    const rowsXml = sheet.rows
      .map((row, r) => {
        const cells = row
          .map((value, c) => {
            const ref = `${colLetter(c)}${r + 1}`;
            if (typeof value === "number") {
              return `<c r="${ref}"><v>${value}</v></c>`;
            }
            return `<c r="${ref}" t="s"><v>${sharedIndex(value)}</v></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    // List validations go after <sheetData>. errorStyle="warning" lets
    // the user keep a value outside the list (with a warning dialog);
    // showDropDown="false" is Excel's inverted flag meaning the
    // dropdown arrow IS shown.
    const validationsXml =
      sheet.validations && sheet.validations.length > 0
        ? `<dataValidations count="${sheet.validations.length}">${sheet.validations
            .map(
              (v) =>
                `<dataValidation type="list" allowBlank="1" showDropDown="false" errorStyle="warning" sqref="${v.sqref}"><formula1>${xmlEscape(v.formula1)}</formula1></dataValidation>`
            )
            .join("")}</dataValidations>`
        : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${rowsXml}</sheetData>${validationsXml}</worksheet>`;
  });

  const workbookSheets = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}"${sheet.hidden ? ` state="hidden"` : ""} r:id="rId${i + 1}"/>`
    )
    .join("");
  const rels = sheets
    .map(
      (sheet, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("");

  const files: Array<{ path: string; data: Buffer }> = [
    {
      path: "[Content_Types].xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
          .map(
            (_s, i) =>
              `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
          )
          .join("")}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
      ),
    },
    {
      path: "_rels/.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ),
    },
    {
      path: "xl/workbook.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`
      ),
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
      ),
    },
    {
      path: "xl/sharedStrings.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">${sharedStrings
          .map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`)
          .join("")}</sst>`
      ),
    },
    {
      path: "xl/styles.xml",
      data: Buffer.from(
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts><font><sz val="11"/><name val="Calibri"/></font></fonts><fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
      ),
    },
  ];
  sheetXmls.forEach((xml, i) => {
    files.push({ path: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(xml) });
  });

  return zipStore(files);
}

// ---------------------------------------------------------------------------
// Reader: returns one array of rows per worksheet (first sheet is index 0).
// Every cell comes back as a string; empty cells are "".
// ---------------------------------------------------------------------------

export function parseXlsx(buffer: Buffer): string[][][] {
  const entries = zipRead(buffer);

  const sharedStrings: string[] = [];
  const sharedXml = entries.get("xl/sharedStrings.xml");
  if (sharedXml) {
    const xml = sharedXml.toString("utf8");
    for (const siMatch of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      const texts: string[] = [];
      for (const tMatch of siMatch[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
        texts.push(xmlUnescape(tMatch[1]));
      }
      sharedStrings.push(texts.join(""));
    }
  }

  const sheetPaths = [...entries.keys()]
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/sheet(\d+)\.xml$/)?.[1] || "0", 10);
      const nb = parseInt(b.match(/sheet(\d+)\.xml$/)?.[1] || "0", 10);
      return na - nb;
    });
  if (sheetPaths.length === 0) {
    throw new Error("No worksheet found in this .xlsx file.");
  }

  return sheetPaths.map((path) => parseSheet(entries.get(path)!.toString("utf8"), sharedStrings));
}

function parseSheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowXml = rowMatch[1];
    const cells: string[] = [];
    for (const cellMatch of rowXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] || "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] || "";
      let value = "";
      if (type === "s") {
        const idx = parseInt(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "", 10);
        value = Number.isNaN(idx) ? "" : sharedStrings[idx] || "";
      } else if (type === "inlineStr") {
        value = xmlUnescape(inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "");
      } else if (type === "str" || type === "b") {
        value = xmlUnescape(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "");
      } else {
        // Number or plain value; keep the raw text.
        value = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      }
      cells[colIndex(ref)] = value;
    }
    // Fill gaps so every row has the same length as its last cell.
    const row: string[] = [];
    for (let i = 0; i < cells.length; i++) {
      row.push(cells[i] ?? "");
    }
    rows.push(row);
  }
  return rows;
}
