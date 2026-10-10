/**
 * PSP edit access — a single shared edit password (env PSP_EDIT_PASSWORD).
 * Viewing /psp needs nothing; a correct password sets a signed, httpOnly
 * cookie that unlocks the content-write API for EDIT_TTL_MS (until explicit logout).
 */
import crypto from "crypto";
import { authSecret } from "@/lib/authSecret";

export const EDIT_COOKIE = "psp_edit";
export const EDIT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // stay signed in as admin for 30 days

const secret = () => authSecret();

/** Edit mode stays locked until PSP_EDIT_PASSWORD is set (.env.local locally, Vercel env in production). */
export function editPassword(): string | null {
  return process.env.PSP_EDIT_PASSWORD || null;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeEditToken(): string {
  const exp = String(Date.now() + EDIT_TTL_MS);
  return `${exp}.${sign(exp)}`;
}

export function verifyEditToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = Buffer.from(sign(exp));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** The password is an email address, so compare it trimmed and case-insensitively
 *  (mobile keyboards auto-capitalize the first letter). */
export function passwordMatches(input: string): boolean {
  const pw = editPassword();
  if (!pw) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  const a = crypto.createHash("sha256").update(norm(input)).digest();
  const b = crypto.createHash("sha256").update(norm(pw)).digest();
  return crypto.timingSafeEqual(a, b);
}
