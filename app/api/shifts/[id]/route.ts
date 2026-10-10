import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.shift.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  // Bug 5: whitelist mutable fields only — employeeId and weekKey are
  // immutable after creation; accepting them allowed shift reassignment
  const { dayOfWeek, startHour, durationHours } = await req.json();
  const update: Record<string, unknown> = {};
  if (dayOfWeek     !== undefined) update.dayOfWeek     = Number(dayOfWeek);
  if (startHour     !== undefined) update.startHour     = Number(startHour);
  if (durationHours !== undefined) update.durationHours = Number(durationHours);

  const shift = await prisma.shift.update({
    where: { id: Number(id) },
    data: update,
    // select (not full include) — passwordHash must never leave the server
    include: { employee: { select: {
      id: true, name: true, color: true, role: true, gender: true,
      dateOfBirth: true, employeeType: true, phone4: true, archived: true,
    } } },
  });
  return NextResponse.json(shift);
}
