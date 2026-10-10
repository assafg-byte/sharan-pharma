import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toMeta } from "@/lib/psp/store";
import { normalizeNucala } from "@/lib/nucala/defaultContent";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/psp/editAuth";

const locked = (req: NextRequest) => !verifyEditToken(req.cookies.get(EDIT_COOKIE)?.value);

export async function GET(req: NextRequest) {
  if (locked(req)) return NextResponse.json({ error: "edit_locked" }, { status: 401 });
  const rows = await prisma.nucalaContentVersion.findMany({
    orderBy: { id: "desc" }, take: 100,
    select: { id: true, editor: true, note: true, createdAt: true },
  });
  return NextResponse.json(rows.map(toMeta));
}

/** Restore: copies an old version forward as a new latest version. Body: { restoreId, editor } */
export async function POST(req: NextRequest) {
  if (locked(req)) return NextResponse.json({ error: "edit_locked" }, { status: 401 });
  const { restoreId, editor } = await req.json().catch(() => ({}));
  const src = await prisma.nucalaContentVersion.findUnique({ where: { id: Number(restoreId) } });
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = await prisma.nucalaContentVersion.create({
    data: { data: src.data, editor: String(editor ?? "").slice(0, 60), note: `שחזור מגרסה #${src.id}` },
  });
  return NextResponse.json({ content: normalizeNucala(JSON.parse(src.data)), version: toMeta(row) });
}
