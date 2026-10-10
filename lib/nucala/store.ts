import { prisma } from "@/lib/db";
import { toMeta } from "@/lib/psp/store";
import { normalizeNucala } from "./defaultContent";
import type { NucalaContent } from "./types";
import type { PspVersionMeta } from "@/lib/psp/types";

/** Latest saved script (normalized), or the built-in default if nothing was saved yet. */
export async function loadNucala(): Promise<{ content: NucalaContent; version: PspVersionMeta | null }> {
  const row = await prisma.nucalaContentVersion.findFirst({ orderBy: { id: "desc" } });
  if (!row) return { content: normalizeNucala(null), version: null };
  let data: unknown = null;
  try { data = JSON.parse(row.data); } catch { /* fall back to defaults */ }
  return { content: normalizeNucala(data), version: toMeta(row) };
}
