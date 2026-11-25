// Dormitory list is stored in the database (Dormitory model) and managed
// from the admin panel — it is NOT hardcoded anywhere in the code.
// "အခြား" is never a database row: it is always appended last in the UI
// and means "free text" in the register form.

export const DORMITORY_OTHER = "အခြား";

/**
 * Fetch active dormitory names from /api/dormitories.
 * On any failure returns an empty list — never a hardcoded fallback —
 * so the register form and directory filter still work with only
 * "အခြား" (free text) available.
 */
export async function fetchDormitoryNames(): Promise<string[]> {
  try {
    const res = await fetch("/api/dormitories");
    if (!res.ok) return [];
    const data = await res.json();
    const list = Array.isArray(data.dormitories) ? data.dormitories : [];
    return list
      .map((d: { name?: unknown }) => String(d.name || "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
