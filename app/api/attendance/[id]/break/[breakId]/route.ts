import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// PATCH — end a break (set breakEnd) or update start/end times
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; breakId: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { breakId } = await params;
  const owner = await prisma.attendanceBreak.findUnique({
    where: { id: Number(breakId) }, select: { attendance: { select: { employeeId: true } } },
  });
  if (!owner) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (auth.role !== "MANAGER" && owner.attendance.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { breakEnd, breakStart } = await req.json();

  const breakRecord = await prisma.attendanceBreak.update({
    where: { id: Number(breakId) },
    data: {
      ...(breakEnd !== undefined ? { breakEnd: breakEnd ? new Date(breakEnd) : null } : {}),
      ...(breakStart !== undefined ? { breakStart: new Date(breakStart) } : {}),
    },
  });

  return NextResponse.json(breakRecord);
}

// DELETE — remove a break segment (manager history correction)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; breakId: string }> }
) {
  // Manager-only: deleting a break rewrites worked-hours history
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { breakId } = await params;
  await prisma.attendanceBreak.delete({ where: { id: Number(breakId) } });

  return NextResponse.json({ ok: true });
}
