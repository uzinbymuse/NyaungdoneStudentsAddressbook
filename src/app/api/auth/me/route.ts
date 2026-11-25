import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const profile = session.alumniId
    ? await prisma.alumniProfile.findUnique({
        where: { id: session.alumniId },
        select: {
          id: true,
          alumniCode: true,
          fullName: true,
          profileStatus: true,
          isDomestic: true,
          countryName: true,
        },
      })
    : null;

  return NextResponse.json({
    user: {
      id: session.userId,
      role: session.role,
      profileStatus: session.profileStatus,
      profile,
    },
  });
}
