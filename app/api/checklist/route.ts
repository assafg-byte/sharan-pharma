import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET() {
  const items = await prisma.checklistItem.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { text, delaySec, pendingLabel, confirmedLabel, confirmedOptions, countOnYes } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const max = await prisma.checklistItem.aggregate({ _max: { order: true } });
  const item = await prisma.checklistItem.create({
    data: {
      text,
      order: (max._max.order ?? -1) + 1,
      delaySec: Number(delaySec) || 0,
      pendingLabel: pendingLabel ?? "",
      confirmedLabel: confirmedLabel ?? "",
      confirmedOptions: confirmedOptions ?? "",
      countOnYes: !!countOnYes,
    },
  });
  return NextResponse.json(item, { status: 201 });
}
