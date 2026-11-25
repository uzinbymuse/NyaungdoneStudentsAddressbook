import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { signSessionToken, verifySessionToken, type SessionPayload } from "./crypto";
import { toWesternDigits } from "./myanmar-utils";
import { prisma } from "./prisma";

export const SESSION_COOKIE_NAME = "nd_alumni_session";

// PINs/passwords are digit-normalized: a PIN typed with Myanmar digits
// (U+1040–U+1049, e.g. from a phone Myanmar keyboard) must match the same
// PIN typed with Latin digits on a PC. Normalizing here covers every
// caller — login, register, change-password, admin credentials, temp PINs.
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(toWesternDigits(password), 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(toWesternDigits(password), hash);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await signSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Always re-validates against DB on sensitive reads so role/status changes take effect immediately.
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const decoded = await verifySessionToken(token);
  if (!decoded) return null;

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      passwordIsTemporary: true,
      profile: {
        select: { id: true, profileStatus: true },
      },
    },
  });

  if (!user || user.accountStatus === "SUSPENDED") {
    return null;
  }

  return {
    userId: user.id,
    role: user.role,
    profileStatus: user.profile?.profileStatus ?? "PENDING",
    alumniId: user.profile?.id,
    mustChangePin: user.passwordIsTemporary === true,
  };
}

export async function requireAuthenticated(): Promise<SessionPayload | null> {
  return getCurrentSession();
}

export async function requireVerifiedMember(): Promise<SessionPayload | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  if (session.role === "ADMIN" || session.profileStatus === "VERIFIED") {
    return session;
  }
  return null;
}

export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getCurrentSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}
