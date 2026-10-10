import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";
import { authSecret } from "@/lib/authSecret";

interface AuthToken {
  employeeId: number;
  role: string;
  name: string;
  gender: string;
  employeeType: string;
}

/**
 * Validate the JWT on an API request and optionally enforce a role.
 * Returns the token payload on success, or null if unauthenticated / wrong role.
 *
 * Usage:
 *   const auth = await requireAuth(req);
 *   if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
 *
 *   const auth = await requireAuth(req, "MANAGER");
 *   if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
 */
export async function requireAuth(
  req: NextRequest,
  role?: "MANAGER" | "EMPLOYEE",
): Promise<AuthToken | null> {
  const token = await getToken({ req, secret: authSecret() });
  if (!token?.employeeId) return null;
  if (role && token.role !== role) return null;
  return token as unknown as AuthToken;
}
