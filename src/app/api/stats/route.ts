import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [verified, domestic, international] = await Promise.all([
    prisma.alumniProfile.count({ where: { profileStatus: "VERIFIED" } }),
    prisma.alumniProfile.count({ where: { profileStatus: "VERIFIED", isDomestic: true } }),
    prisma.alumniProfile.count({ where: { profileStatus: "VERIFIED", isDomestic: false } }),
  ]);

  return NextResponse.json({ verified, domestic, international });
}
