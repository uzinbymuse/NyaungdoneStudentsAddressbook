// Myanmar text utilities: Zawgyi-to-Unicode detection & conversion, numeral normalization, and search normalization.

const MYANMAR_DIGITS = ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"];

/**
 * Convert Western digits (0-9) to Myanmar digits (၀-၉)
 */
export function toMyanmarDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => MYANMAR_DIGITS[Number(d)]);
}

/**
 * Convert Myanmar digits (၀-၉) to Western digits (0-9)
 */
export function toWesternDigits(input: string): string {
  return input.replace(/[၀-၉]/g, (d) => String(MYANMAR_DIGITS.indexOf(d)));
}

/**
 * Heuristic check for common Zawgyi-only codepoints/sequences.
 */
export function isLikelyZawgyi(text: string): boolean {
  if (!text) return false;
  // Zawgyi-ONLY codepoints: \u105A (ဉ), \u1060-\u1097, \u1033, \u1034,
  // \u107D-\u108A, or leading \u1031 before a consonant.
  // NOTE: \u103A (asat "်"), \u103C and \u103D are VALID Unicode too
  // (they appear in almost every correct Unicode word with "်"), so
  // they must NOT be treated as Zawgyi evidence — the old check did,
  // and correct Unicode text was then "converted" into garbage.
  const zgSpecific = /[\u105A\u1060-\u1097\u1033\u1034\u107D-\u108A]/;
  // In Unicode, \u1031 comes AFTER its consonant, so "consonant +
  // \u1031 + next consonant" (e.g. ဇေ + ယ in "ဇေယျာ", ရွှေ + ဘ in
  // "ရွှေဘို") is NORMAL Unicode. It is Zawgyi order only when \u1031
  // is NOT preceded by a consonant/medial — i.e. at the start of the
  // string or after a space/punctuation — and followed by a consonant.
  // The old check /\\u1031[\\u1000-\\u1021]/ matched normal Unicode
  // too, so "ရွှေဘို" was "converted" into "ရှှဘေို" and
  // "ဇေယျာသိင်္ဂီ" could not be fixed at all.
  const zgLeadingE = /(^|[^\u1000-\u1021\u103B-\u103E])\u1031[\u1000-\u1021]/;
  return zgSpecific.test(text) || zgLeadingE.test(text);
}

/**
 * Lightweight Zawgyi-to-Unicode normalizer for common Myanmar form inputs.
 * Preserves already-valid Unicode text untouched.
 */
export function normalizeMyanmarText(input: string): string {
  if (!input) return "";
  let s = input.trim().normalize("NFC");

  if (!isLikelyZawgyi(s)) {
    return s.replace(/\s+/g, " ");
  }

  // Single-pass Zawgyi -> Unicode mapping: each input character is
  // translated at most once, so a replacement output is never re-matched
  // by a later rule. The old sequential .replace() chain did exactly
  // that — e.g. \u103A became \u103B, then \u103C, then \u103D, then
  // \u103E — turning correct text like "မဏ္ဍိုင်" into "မဏ်ဍိုငှ".
  const singleCharMap = new Map<string, string>([
    ["\u106A", "\u1009"],
    ["\u106B", "\u100A"],
    ["\u1090", "\u101B"],
    ["\u108F", "\u1014"],
    ["\u1091", "\u100F"],
    ["\u1092", "\u100B"],
    ["\u1097", "\u100C"],
    ["\u106E", "\u100D"],
    ["\u106F", "\u100E"],
    ["\u1086", "\u103F"],
    ["\u1064", "\u1004\u103A\u1039"],
    ["\u103A", "\u103B"],
    ["\u103B", "\u103C"],
    ["\u107D", "\u103B"],
    ["\u107E", "\u103C"],
    ["\u107F", "\u103C"],
    ["\u1080", "\u103C"],
    ["\u1081", "\u103C"],
    ["\u1082", "\u103C"],
    ["\u1083", "\u103C"],
    ["\u1084", "\u103C"],
    ["\u103C", "\u103D"],
    ["\u103D", "\u103E"],
    ["\u108A", "\u103D\u103E"],
    ["\u1033", "\u102F"],
    ["\u1034", "\u1030"],
    ["\u1094", "\u1037"],
    ["\u1095", "\u1037"],
    ["\u1039", "\u103A"],
  ]);

  let out = "";
  for (const ch of s) {
    out += singleCharMap.get(ch) ?? ch;
  }

  // Reorder a LEADING e-vowel (\u1031) to after its consonant
  // (+ optional medials) — only when it is at the start of the string
  // or after a space, i.e. genuine Zawgyi order. A \u1031 that already
  // follows its consonant (normal Unicode) must be left alone: the old
  // pattern moved it after the NEXT consonant, turning "ရွှေဘို" into
  // "ရှှဘေို".
  out = out.replace(
    /(^|\s)\u1031([\u1000-\u1021][\u103B-\u103E]*)/g,
    "$1$2\u1031"
  );

  return out.replace(/\s+/g, " ").trim();
}

/**
 * Produce a normalized key for duplicate detection and fuzzy search.
 * Strips spaces, common honorific prefixes, and normalizes digits.
 */
export function buildSearchNameKey(name: string): string {
  const unicode = normalizeMyanmarText(name).toLowerCase();
  return toWesternDigits(unicode)
    .replace(/^(အရှင်|ဦး|ဒေါ်|ကို|မ|ဆရာတော်|ဘဒ္ဒန္တ|သီလရှင်|ဒေါ်)\s*/g, "")
    .replace(/[\s\-_.()（）]/g, "");
}

/**
 * Normalize phone number to digits + optional leading + for HMAC lookup.
 */
export function normalizePhoneForHash(phone: string): string {
  const western = toWesternDigits(phone).trim();
  const hasPlus = western.startsWith("+");
  const digits = western.replace(/\D/g, "");
  // Convert local 09... to 959... for consistent duplicate detection
  if (!hasPlus && digits.startsWith("09")) {
    return "95" + digits.slice(1);
  }
  return digits;
}

/**
 * Mask a phone number for privacy-first display, e.g. 09-79***890
 */
export function maskPhone(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 5) return "***";
  const start = clean.slice(0, 4);
  const end = clean.slice(-3);
  return `${start}***${end}`;
}
