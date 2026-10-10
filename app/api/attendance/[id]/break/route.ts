import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// POST — start a break on an attendance record
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const owner = await prisma.attendance.findUnique({ where: { id: Number(id) }, select: { employeeId: true } });
  if (!owner) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (auth.role !== "MANAGER" && owner.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const breakStart = body.breakStart ? new Date(body.breakStart) : new Date();
  const expectedEnd = body.expectedEnd ? new Date(body.expectedEnd) : undefined;

  const breakRecord = await prisma.attendanceBreak.create({
    data: {
      attendanceId: Number(id),
      breakStart,
      ...(expectedEnd ? { expectedEnd } : {}),
    },
  });

  return NextResponse.json(breakRecord, { status: 201 });
}
