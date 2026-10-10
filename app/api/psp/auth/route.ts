import { NextRequest, NextResponse } from "next/server";
import { EDIT_COOKIE, EDIT_TTL_MS, editPassword, makeEditToken, passwordMatches, verifyEditToken } from "@/lib/psp/editAuth";

export async function GET(req: NextRequest) {
  return NextResponse.json({ editing: verifyEditToken(req.cookies.get(EDIT_COOKIE)?.value) });
}

export async function POST(req: NextRequest) {
  if (!editPassword()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !passwordMatches(password)) {
    await new Promise(r => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "wrong_password" }, { status: 401 });
  }
  const res = NextResponse.json({ editing: true });
  res.cookies.set(EDIT_COOKIE, makeEditToken(), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: EDIT_TTL_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ editing: false });
  res.cookies.set(EDIT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
