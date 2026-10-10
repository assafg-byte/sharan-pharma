import type { Due } from "./types";

export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const addWeeks = (d: Date, n: number) => addDays(d, n * 7);
export const weeksBetween = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / 604800000);
export const midnight = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
export const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

export function parseDMY(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || "").trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  return dt.getDate() === d && dt.getMonth() === mo - 1 ? dt : null;
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const fillVars = (s: string, vars: Record<string, string> = {}) =>
  s.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? vars[k] : all));

/** Editable text → safe HTML. Supports **bold**, line breaks, {vars} and [label](https://…) links. */
export function rich(s: string | undefined, vars?: Record<string, string>): string {
  if (!s) return "";
  return esc(fillVars(s, vars))
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)"<>]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([\s\S]+?)\*\*/g, "<b>$1</b>")
    .replace(/\n/g, "<br>");
}

/** Plain text for search / copy — strips the ** markers and link syntax. */
export const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");

export type ResolvedDue = { kind: "date"; date: Date } | { kind: "text"; text: string } | { kind: "none" };

export function resolveDue(due: Due, bases: Record<string, Date | null>, unknownText: string): ResolvedDue {
  if (due.kind === "none") return { kind: "none" };
  if (due.kind === "text") return { kind: "text", text: due.text };
  const b = bases[due.base];
  if (!b) return { kind: "text", text: due.fallback || unknownText };
  return { kind: "date", date: addDays(b, (due.weeks || 0) * 7 + (due.days || 0)) };
}

export function describeDue(due: Due, baseLabels: Record<string, string> = {}): string {
  if (due.kind === "none") return "—";
  if (due.kind === "text") return due.text || "—";
  const parts: string[] = [];
  if (due.weeks) parts.push(`${due.weeks} שבועות`);
  if (due.days) parts.push(`${due.days} ימים`);
  return `${baseLabels[due.base] ?? due.base}${parts.length ? " + " + parts.join(" + ") : ""}`;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
