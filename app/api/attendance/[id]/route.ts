import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function PATCH(
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
  // Only checkInTime and checkOutTime may be updated — spreading the full body
  // would allow changing employeeId, date, or weekKey, enabling record forgery
  const { checkOutTime, checkInTime } = await req.json();

  const record = await prisma.attendance.update({
    where: { id: Number(id) },
    data: {
      ...(checkOutTime !== undefined ? { checkOutTime: checkOutTime ? new Date(checkOutTime) : null } : {}),
      ...(checkInTime !== undefined ? { checkInTime: checkInTime ? new Date(checkInTime) : null } : {}),
    },
    include: { breaks: { orderBy: { breakStart: "asc" } } },
  });
  return NextResponse.json(record);
}
