import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

const getCachedDormitories = unstable_cache(
  async () => {
    return prisma.dormitory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
  },
  ["public-dormitories"],
  { revalidate: 60 }
);

/**
 * Public list of active dormitories, in admin-defined order.
 * Cached for 60s for instant form & filter rendering.
 */
export async function GET() {
  const rows = await getCachedDormitories();
  return NextResponse.json(
    { dormitories: rows },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
