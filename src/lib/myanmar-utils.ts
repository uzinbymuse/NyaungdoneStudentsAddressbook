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
  // Zawgyi-specific codepoints: \u105A (ဉ), \u1060-\u1097, or leading \u1031 before consonant
  const zgSpecific = /[\u105A\u1060-\u1097\u1033\u1034\u103A\u103C\u103D\u107D-\u108A]/;
  // In Unicode, \u1031 comes AFTER the consonant; in Zawgyi, \u1031 comes BEFORE [\u1000-\u1021]
  const zgLeadingE = /\u1031[\u1000-\u1021]/;
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

  // Common Zawgyi -> Unicode mappings
  const replacements: Array<[RegExp, string]> = [
    [/\u106A/g, "\u1009"],
    [/\u106B/g, "\u100A"],
    [/\u1090/g, "\u101B"],
    [/\u108F/g, "\u1014"],
    [/\u1091/g, "\u100F"],
    [/\u1092/g, "\u100B"],
    [/\u1097/g, "\u100C"],
    [/\u106E/g, "\u100D"],
    [/\u106F/g, "\u100E"],
    [/\u1086/g, "\u103F"],
    [/\u1064/g, "\u1004\u103A\u1039"],
    [/\u103A/g, "\u103B"],
    [/\u103B/g, "\u103C"],
    [/\u107D/g, "\u103B"],
    [/\u107E/g, "\u103C"],
    [/\u107F/g, "\u103C"],
    [/\u1080/g, "\u103C"],
    [/\u1081/g, "\u103C"],
    [/\u1082/g, "\u103C"],
    [/\u1083/g, "\u103C"],
    [/\u1084/g, "\u103C"],
    [/\u103C/g, "\u103D"],
    [/\u103D/g, "\u103E"],
    [/\u108A/g, "\u103D\u103E"],
    [/\u1033/g, "\u102F"],
    [/\u1034/g, "\u1030"],
    [/\u1094/g, "\u1037"],
    [/\u1095/g, "\u1037"],
    [/\u1039/g, "\u103A"],
    // Reorder leading e-vowel (\u1031) after consonant (+ optional medials)
    [/\u1031([\u1000-\u1021][\u103B-\u103E]*)/g, "$1\u1031"],
  ];

  for (const [pattern, replacement] of replacements) {
    s = s.replace(pattern, replacement);
  }

  return s.replace(/\s+/g, " ").trim();
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
