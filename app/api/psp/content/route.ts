import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadLatest, toMeta } from "@/lib/psp/store";
import { normalizeContent } from "@/lib/psp/defaultContent";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/psp/editAuth";

const MAX_BYTES = 1_500_000;

export async function GET() {
  return NextResponse.json(await loadLatest());
}

/** Save a new version. Body: { content, editor, note, baseVersion } */
export async function PUT(req: NextRequest) {
  if (!verifyEditToken(req.cookies.get(EDIT_COOKIE)?.value)) {
    return NextResponse.json({ error: "edit_locked" }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let body: { content?: unknown; editor?: string; note?: string; baseVersion?: number | null };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.content || typeof body.content !== "object") {
    return NextResponse.json({ error: "missing_content" }, { status: 400 });
  }

  // Optimistic concurrency: refuse to overwrite a version saved by someone else meanwhile.
  const latest = await prisma.pspContentVersion.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  if ((latest?.id ?? null) !== (body.baseVersion ?? null)) {
    return NextResponse.json({ error: "conflict", latestVersion: latest?.id ?? null }, { status: 409 });
  }

  const content = normalizeContent(body.content);
  const row = await prisma.pspContentVersion.create({
    data: {
      data: JSON.stringify(content),
      editor: String(body.editor ?? "").slice(0, 60),
      note: String(body.note ?? "").slice(0, 200),
    },
  });
  return NextResponse.json({ content, version: toMeta(row) });
}
