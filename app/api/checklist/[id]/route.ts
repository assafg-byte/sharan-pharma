import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { text, delaySec, pendingLabel, confirmedLabel, confirmedOptions, order, countOnYes } = await req.json();
  const update: Record<string, unknown> = {};
  if (text             !== undefined) update.text             = text;
  if (delaySec         !== undefined) update.delaySec         = Number(delaySec) || 0;
  if (pendingLabel     !== undefined) update.pendingLabel     = pendingLabel ?? "";
  if (confirmedLabel   !== undefined) update.confirmedLabel   = confirmedLabel ?? "";
  if (confirmedOptions !== undefined) update.confirmedOptions = confirmedOptions ?? "";
  if (order            !== undefined) update.order            = Number(order) || 0;
  if (countOnYes       !== undefined) update.countOnYes       = !!countOnYes;

  const item = await prisma.checklistItem.update({
    where: { id: Number(id) },
    data: update,
  });
  return NextResponse.json(item);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.checklistItem.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
