// Old-book Excel import: column definitions, row parsing and validation.
//
// The admin types the previous print book's data into the .xlsx template
// and uploads it. This module is pure (no DB): the API route calls
// parseImportSheet for the preview and again for the confirm step, then
// does the duplicate check against the database itself.

import { hmacLookup } from "./crypto";
import {
  buildSearchNameKey,
  normalizeMyanmarText,
  normalizePhoneForHash,
  toWesternDigits,
} from "./myanmar-utils";
import { COUNTRIES } from "./mimu-locations";

export const TEMP_PIN_VALIDITY_DAYS = 60;
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export function isValidTempPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export interface ImportColumn {
  key: string;
  header: string;
  required: boolean;
  aliases?: string[];
}

export const IMPORT_COLUMNS: ImportColumn[] = [
  { key: "fullName", header: "အမည်", required: true },
  { key: "monkOrLay", header: "ရဟန်း/လူ", required: true, aliases: ["ရဟန်း / လူ"] },
  {
    key: "degreeName",
    header: "အမြင့်ဆုံး သင်ယူ/အောင်ခဲ့သည့် အတန်း",
    required: false,
    aliases: ["ဘွဲ့"],
  },
  {
    key: "batchYearDisplay",
    header: "ကျောင်းသို့ရောက်သည့်ခုနှစ်",
    required: true,
    aliases: ["ဘတ်ချ်", "Batch", "ကျောင်းဝင်/ဘွဲ့ရ မြန်မာခုနှစ် (Batch)"],
  },
  { key: "dormitory", header: "ကျောင်းဆောင်", required: true },
  { key: "currentMonastery", header: "လက်ရှိကျောင်းတိုက်-ကျောင်းဆောင်", required: false },
  {
    key: "currentRoleOrMonastery",
    header: "အလုပ်/တာဝန်",
    required: true,
    aliases: ["လက်ရှိတာဝန်"],
  },
  { key: "countryName", header: "နိုင်ငံ", required: false },
  { key: "region", header: "တိုင်း/ပြည်နယ်", required: false },
  { key: "townshipOrCity", header: "မြို့နယ်/မြို့", required: true, aliases: ["မြို့နယ်", "မြို့"] },
  { key: "wardOrVillage", header: "ရွာ/ရပ်ကွက်", required: false },
  { key: "phonePrimary", header: "ဖုန်း", required: true, aliases: ["ဖုန်းနံပါတ်"] },
  { key: "phoneSecondary", header: "ဖုန်း (အရန်)", required: false },
  { key: "viber", header: "Viber", required: false },
  { key: "telegram", header: "Telegram", required: false },
  { key: "email", header: "အီးမေးလ်", required: false, aliases: ["Email", "အီးမေးလ်လိပ်စာ"] },
  { key: "facebook", header: "Facebook", required: false },
];

/** Header row for the downloadable template ("*" marks required columns). */
export function templateHeaders(): string[] {
  return IMPORT_COLUMNS.map((c) => (c.required ? `${c.header} *` : c.header));
}

export interface ValidImportRow {
  fullName: string;
  normalizedName: string;
  monkOrLay: "MONK" | "LAY" | "NUN" | "OTHER";
  degreeName: string | null;
  batchYearDisplay: string;
  batchYearMm: number | null;
  dormitory: string;
  currentMonastery: string | null;
  currentRoleOrMonastery: string;
  countryCode: string;
  countryName: string;
  isDomestic: boolean;
  region: string | null;
  township: string | null;
  city: string;
  wardOrVillage: string | null;
  phonePrimary: string;
  phoneLookupHash: string;
  phoneSecondary: string | null;
  viber: string | null;
  telegram: string | null;
  email: string | null;
  facebook: string | null;
}

export interface ImportRowResult {
  /** 1-based sheet row number (row 1 is the header). */
  rowNumber: number;
  fullName: string;
  phonePrimary: string;
  status: "ok" | "error";
  errors: string[];
  data: ValidImportRow | null;
}

export interface ImportParseResult {
  headerErrors: string[];
  totalRows: number;
  results: ImportRowResult[];
}

function normalizeHeaderCell(cell: string): string {
  return cell.trim().replace(/\*$/, "").trim();
}

function resolveCountry(raw: string): {
  countryCode: string;
  countryName: string;
  isDomestic: boolean;
} {
  const text = normalizeMyanmarText(raw);
  if (!text) return { countryCode: "MM", countryName: "မြန်မာ", isDomestic: true };
  if (text === "အခြား") return { countryCode: "OTHER", countryName: "အခြား", isDomestic: false };
  const found = COUNTRIES.find(
    (c) =>
      c.code === text.toUpperCase() ||
      normalizeMyanmarText(c.nameMm) === text ||
      c.nameEn.toLowerCase() === text.toLowerCase()
  );
  if (found) {
    if (found.code === "OTHER") return { countryCode: "OTHER", countryName: "အခြား", isDomestic: false };
    return { countryCode: found.code, countryName: found.nameMm, isDomestic: found.code === "MM" };
  }
  return { countryCode: "OTHER", countryName: text, isDomestic: false };
}

function resolveMonkOrLay(raw: string): "MONK" | "LAY" | "NUN" | "OTHER" | null {
  const v = normalizeMyanmarText(raw).toLowerCase();
  if (["ရဟန်း", "ဘုန်း", "monk"].includes(v)) return "MONK";
  if (["လူ", "lay"].includes(v)) return "LAY";
  if (["သီလရှင်", "nun"].includes(v)) return "NUN";
  if (["အခြား", "other"].includes(v)) return "OTHER";
  return null;
}

/**
 * Excel drops the leading 0 when a phone is typed as a number
 * (09791234567 becomes 9791234567). Restore it for domestic numbers.
 */
function normalizeImportPhone(raw: string, isDomestic: boolean): string {
  const western = toWesternDigits(raw).trim();
  const hasPlus = western.startsWith("+");
  let digits = western.replace(/\D/g, "");
  if (isDomestic && !hasPlus && digits.length === 10 && digits.startsWith("9")) {
    digits = "0" + digits;
  }
  return hasPlus ? `+${digits}` : digits;
}

function validateRow(
  rowNumber: number,
  raw: Record<string, string>
): ImportRowResult {
  const errors: string[] = [];
  const fail = (fullName: string, phonePrimary: string): ImportRowResult => ({
    rowNumber,
    fullName,
    phonePrimary,
    status: "error",
    errors,
    data: null,
  });

  const fullName = normalizeMyanmarText(raw.fullName || "");
  if (!fullName) errors.push("အမည် မပါပါ");

  const monkOrLay = resolveMonkOrLay(raw.monkOrLay || "");
  if (!monkOrLay) errors.push("ရဟန်း/လူ ကို ရဟန်း (သို့) လူ လို့ ထည့်ပါ");

  const batchYearDisplay = normalizeMyanmarText(raw.batchYearDisplay || "");
  if (!batchYearDisplay) errors.push("ကျောင်းသို့ရောက်သည့်ခုနှစ် မပါပါ");

  const dormitory = normalizeMyanmarText(raw.dormitory || "");
  if (!dormitory) errors.push("ကျောင်းဆောင် မပါပါ");

  const currentMonastery = normalizeMyanmarText(raw.currentMonastery || "");

  const currentRoleOrMonastery = normalizeMyanmarText(raw.currentRoleOrMonastery || "");
  if (!currentRoleOrMonastery) errors.push("အလုပ်/တာဝန် မပါပါ");

  const townshipOrCity = normalizeMyanmarText(raw.townshipOrCity || "");
  if (!townshipOrCity) errors.push("မြို့နယ်/မြို့ မပါပါ");

  const country = resolveCountry(raw.countryName || "");
  const region = raw.region ? normalizeMyanmarText(raw.region) : null;
  if (country.isDomestic && !region) errors.push("ပြည်တွင်းအတွက် တိုင်း/ပြည်နယ် ရွေးပါ");

  const phonePrimary = normalizeImportPhone(raw.phonePrimary || "", country.isDomestic);
  const phoneDigits = normalizePhoneForHash(phonePrimary);
  if (!phonePrimary) {
    errors.push("ဖုန်း မပါပါ");
  } else if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    errors.push("ဖုန်းနံပါတ် မမှန်ပါ");
  }

  const emailRaw = (raw.email || "").trim().toLowerCase();
  if (emailRaw && !/.+@.+\..+/.test(emailRaw)) errors.push("အီးမေးလ် ပုံစံ မမှန်ပါ");

  if (errors.length > 0) return fail(fullName, phonePrimary);

  const batchDigits = toWesternDigits(batchYearDisplay).match(/\d{4}/);
  const batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;

  const data: ValidImportRow = {
    fullName,
    normalizedName: buildSearchNameKey(fullName),
    monkOrLay: monkOrLay as "MONK" | "LAY" | "NUN" | "OTHER",
    degreeName: raw.degreeName ? normalizeMyanmarText(raw.degreeName) : null,
    batchYearDisplay,
    batchYearMm,
    dormitory,
    currentMonastery: currentMonastery || null,
    currentRoleOrMonastery,
    countryCode: country.countryCode,
    countryName: country.countryName,
    isDomestic: country.isDomestic,
    region,
    township: country.isDomestic ? townshipOrCity : null,
    city: townshipOrCity,
    wardOrVillage: raw.wardOrVillage ? normalizeMyanmarText(raw.wardOrVillage) : null,
    phonePrimary,
    phoneLookupHash: hmacLookup(phoneDigits),
    phoneSecondary: raw.phoneSecondary
      ? normalizeImportPhone(raw.phoneSecondary, country.isDomestic)
      : null,
    viber: raw.viber ? raw.viber.trim() : null,
    telegram: raw.telegram ? raw.telegram.trim() : null,
    email: emailRaw || null,
    facebook: raw.facebook ? raw.facebook.trim() : null,
  };

  return { rowNumber, fullName, phonePrimary, status: "ok", errors: [], data };
}

/**
 * Parse the first worksheet of an .xlsx file (already read into rows of
 * strings). Row 1 is the header; data starts at row 2. Fully empty rows
 * are skipped.
 */
export function parseImportSheet(sheetRows: string[][]): ImportParseResult {
  if (sheetRows.length === 0) {
    return { headerErrors: ["ဖိုင်ထဲမှာ အချက်အလက် မတွေ့ပါ"], totalRows: 0, results: [] };
  }

  const headerRow = sheetRows[0];
  const colIndexByKey = new Map<string, number>();
  const headerErrors: string[] = [];
  for (const col of IMPORT_COLUMNS) {
    const candidates = [col.header, ...(col.aliases || [])].map((h) =>
      normalizeHeaderCell(h)
    );
    const idx = headerRow.findIndex((cell) =>
      candidates.includes(normalizeHeaderCell(cell || ""))
    );
    if (idx === -1) {
      if (col.required) headerErrors.push(`ခေါင်းစဉ် "${col.header}" မတွေ့ပါ`);
    } else {
      colIndexByKey.set(col.key, idx);
    }
  }
  if (headerErrors.length > 0) {
    return { headerErrors, totalRows: 0, results: [] };
  }

  const results: ImportRowResult[] = [];
  const dataRows = sheetRows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      headerErrors: [`အတန်း ${MAX_IMPORT_ROWS} ထက် မပိုပါနဲ့ (တွေ့တာ ${dataRows.length} တန်း)`],
      totalRows: 0,
      results: [],
    };
  }

  const seenPhones = new Map<string, number>();
  dataRows.forEach((cells, i) => {
    const rowNumber = i + 2;
    const raw: Record<string, string> = {};
    for (const col of IMPORT_COLUMNS) {
      const idx = colIndexByKey.get(col.key);
      raw[col.key] = idx !== undefined ? (cells[idx] || "").trim() : "";
    }
    if (Object.values(raw).every((v) => !v)) return; // skip empty row
    const result = validateRow(rowNumber, raw);
    if (result.status === "ok" && result.data) {
      const hash = result.data.phoneLookupHash;
      const firstSeen = seenPhones.get(hash);
      if (firstSeen !== undefined) {
        result.status = "error";
        result.errors = [`ဖိုင်ထဲမှာ ဖုန်းနံပါတ် ထပ်နေသည် (အတန်း ${firstSeen} နှင့် တူသည်)`];
        result.data = null;
      } else {
        seenPhones.set(hash, rowNumber);
      }
    }
    results.push(result);
  });

  return { headerErrors: [], totalRows: results.length, results };
}
