import { prisma } from "@/lib/db";
import { normalizeContent } from "./defaultContent";
import type { PspContent, PspVersionMeta } from "./types";

type Row = { id: number; editor: string; note: string; createdAt: Date };
export const toMeta = (r: Row): PspVersionMeta =>
  ({ id: r.id, editor: r.editor, note: r.note, createdAt: r.createdAt.toISOString() });

/** Latest saved content (normalized), or the built-in defaults if nothing was saved yet. */
export async function loadLatest(): Promise<{ content: PspContent; version: PspVersionMeta | null }> {
  const row = await prisma.pspContentVersion.findFirst({ orderBy: { id: "desc" } });
  if (!row) return { content: normalizeContent(null), version: null };
  let data: unknown = null;
  try { data = JSON.parse(row.data); } catch { /* fall back to defaults */ }
  return { content: normalizeContent(data), version: toMeta(row) };
}
