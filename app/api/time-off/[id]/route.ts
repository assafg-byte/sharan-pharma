import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

const VALID_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type TimeOffStatus = typeof VALID_STATUSES[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { status } = await req.json();

  // Bug 6: validate the status enum — the DB column is a plain String, so
  // Prisma accepts any value; invalid statuses corrupt badge counts and reporting
  if (!VALID_STATUSES.includes(status as TimeOffStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const request = await prisma.timeOffRequest.update({
    where: { id: Number(id) },
    data: { status },
    include: { employee: { select: { id: true, name: true, color: true } } },
  });

  // Deciding the request is the resolution — clear its pending notification
  if (status !== "PENDING") {
    await prisma.notification.updateMany({
      where: { type: "TIME_OFF_PENDING", entityId: request.id },
      data: { read: true },
    }).catch(() => {});
  }
  return NextResponse.json(request);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // Employees may only delete their own requests; managers may delete any
  const existing = await prisma.timeOffRequest.findUnique({ where: { id: Number(id) } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (auth.role !== "MANAGER" && existing.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.timeOffRequest.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
