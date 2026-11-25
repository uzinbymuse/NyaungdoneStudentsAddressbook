import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Public list of active dormitories, in admin-defined order.
 * The list may legitimately be EMPTY (the admin adds names after deploy)
 * — callers must handle that and offer "အခြား" free text instead.
 */
export async function GET() {
  const rows = await prisma.dormitory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  return NextResponse.json({ dormitories: rows });
}
