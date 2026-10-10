/**
 * The signing secret for login tokens and the PSP edit cookie. There is
 * deliberately NO fallback value: a default secret that lives in the source
 * code would let anyone who reads it forge a login. Set NEXTAUTH_SECRET in
 * the environment (see .env.example) — the app refuses to run without it.
 */
export function authSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET is not set — see .env.example");
  return s;
}
