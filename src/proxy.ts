import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
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
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
