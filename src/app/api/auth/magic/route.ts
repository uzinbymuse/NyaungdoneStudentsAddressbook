import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/crypto";
import { setSessionCookie } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const tokenHash = hashToken(token);
  const user = await prisma.user.findUnique({
    where: { magicTokenHash: tokenHash },
    include: { profile: { select: { id: true, profileStatus: true } } },
  });

  if (
    !user ||
    !user.magicTokenExpiresAt ||
    user.magicTokenExpiresAt < new Date() ||
    user.accountStatus === "SUSPENDED"
  ) {
    return NextResponse.redirect(new URL("/login?error=expired_token", req.url));
  }

  const isTempPin = user.passwordIsTemporary === true;
  if (
    isTempPin &&
    user.tempPasswordExpiresAt &&
    user.tempPasswordExpiresAt < new Date()
  ) {
    // Do NOT consume the magic link: the member still needs it to get in.
    return NextResponse.redirect(new URL("/login?error=temp_pin_expired", req.url));
  }

  // Single-use token: clear immediately
  await prisma.user.update({
    where: { id: user.id },
    data: {
      magicTokenHash: null,
      magicTokenExpiresAt: null,
      lastLoginAt: new Date(),
    },
  });

  await setSessionCookie({
    userId: user.id,
    role: user.role,
    profileStatus: user.profile?.profileStatus ?? "PENDING",
    alumniId: user.profile?.id,
    mustChangePin: isTempPin,
  });

  await logAudit({
    actorId: user.id,
    action: "MAGIC_LOGIN_SUCCESS",
    targetType: "User",
    targetId: user.id,
  });

  const dest = isTempPin
    ? "/set-pin"
    : user.profile?.profileStatus === "VERIFIED"
      ? "/directory"
      : "/profile";
  return NextResponse.redirect(new URL(dest, req.url));
}
