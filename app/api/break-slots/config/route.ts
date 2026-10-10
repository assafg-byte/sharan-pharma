import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// Manager-configured break window (start–end range). The picker generates
// 30-minute slots from this range client- and server-side.
export async function GET() {
  const config = await prisma.breakSlotConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, startHour: 12, endHour: 16 },
  });
  return NextResponse.json({ startHour: config.startHour, endHour: config.endHour });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { startHour, endHour } = await req.json();
  const s = Number(startHour), e = Number(endHour);
  const isHalfHour = (n: number) => Number.isFinite(n) && Math.round(n * 2) === n * 2;
  if (!isHalfHour(s) || !isHalfHour(e) || s < 0 || e > 24 || s >= e) {
    return NextResponse.json({ error: "invalid range — must be half-hour aligned and start before end" }, { status: 400 });
  }

  const config = await prisma.breakSlotConfig.upsert({
    where: { id: 1 },
    update: { startHour: s, endHour: e },
    create: { id: 1, startHour: s, endHour: e },
  });
  return NextResponse.json({ startHour: config.startHour, endHour: config.endHour });
}
