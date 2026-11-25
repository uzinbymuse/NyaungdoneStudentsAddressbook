import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/crypto";

// Keep in sync with SESSION_COOKIE_NAME in src/lib/auth.ts.
const SESSION_COOKIE_NAME = "nd_alumni_session";
const SET_PIN_PATH = "/set-pin";

// These API routes must stay reachable while the PIN is still temporary:
// login + magic mint fresh sessions, change-password clears the flag,
// logout ends the session, me lets pages read the session.
const ALLOWED_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/magic",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/me",
];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  // Prevent search engine indexing of member-only and admin routes
  if (
    path.startsWith("/directory") ||
    path.startsWith("/profile") ||
    path.startsWith("/admin")
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Accounts imported from the old book log in with a shared temporary
  // PIN and must choose their own PIN before using anything else.
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const session = await verifySessionToken(token);
    if (session?.mustChangePin) {
      if (path === SET_PIN_PATH) return response;
      if (ALLOWED_API_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return response;
      }
      if (path.startsWith("/api/")) {
        return NextResponse.json(
          { error: "PIN အသစ် ပြောင်းလဲရန် လိုအပ်ပါသည်။", mustChangePin: true },
          { status: 403 }
        );
      }
      return NextResponse.redirect(new URL(SET_PIN_PATH, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
