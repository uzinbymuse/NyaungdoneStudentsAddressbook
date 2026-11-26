// Admin opt-out for web contact details (2026-11-26).
//
// Web contacts are shown to every logged-in member by default. When the
// admin ticks "ဆက်သွယ်ရန်အချက်အလက်များကို Web မှာ ဖုံးထားမည်" for one
// person, their hideContactsWeb flag is set and the directory masks
// their phone and hides the other channels.
//
// The column is added in the same deploy as the code that reads it, and
// the user runs `npx prisma db push` on their PC afterwards. Until the
// push runs, this query fails with P2022 (column does not exist) —
// caught here so the directory keeps working in that window, with
// everyone shown (the new default).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getHiddenContactIds(
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Set<string>> {
  try {
    const rows = await db.alumniProfile.findMany({
      where: { hideContactsWeb: true },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  } catch (e) {
    if ((e as { code?: string })?.code === "P2022") return new Set();
    throw e;
  }
}
