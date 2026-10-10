import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { authSecret } from "@/lib/authSecret";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // NextAuth's own callback routes must be reachable without a session
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  // Lilly PSP and the Nucala script are public to view; writes are guarded by the admin password cookie
  if (pathname.startsWith("/api/psp/") || pathname.startsWith("/api/nucala/")) return NextResponse.next();

  const token = await getToken({ req, secret: authSecret() });

  if (!token) {
    // API routes: return 401 JSON — clients handle the error, not a redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Page routes: redirect to login
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Page-level role guards (API routes are role-checked individually where needed)
  if (pathname.startsWith("/manager") && token.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/employee", req.url));
  }
  if (pathname.startsWith("/employee") && token.role === "MANAGER") {
    return NextResponse.redirect(new URL("/manager", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/manager/:path*",
    "/employee/:path*",
    // All API routes except NextAuth's own auth endpoints
    "/api/((?!auth/).*)",
  ],
};
