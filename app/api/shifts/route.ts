import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// passwordHash must never leave the server
const EMPLOYEE_SELECT = {
  id: true, name: true, color: true, role: true, gender: true,
  dateOfBirth: true, employeeType: true, phone4: true, archived: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const weekKey = req.nextUrl.searchParams.get("weekKey") ?? "";
  const shifts = await prisma.shift.findMany({
    where: weekKey ? { weekKey } : undefined,
    include: { employee: { select: EMPLOYEE_SELECT } },
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
  });
  return NextResponse.json(shifts);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { employeeId, dayOfWeek, startHour, durationHours, weekKey } = await req.json();
  if (!Number.isInteger(employeeId) || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 4
      || !Number.isFinite(startHour) || !Number.isFinite(durationHours) || durationHours <= 0) {
    return NextResponse.json({ error: "invalid shift (dayOfWeek must be 0–4)" }, { status: 400 });
  }

  // Idempotent: an exact duplicate is never legitimate (the UI blocks it) —
  // return the existing record instead of stacking a copy (double-click safety)
  const duplicate = await prisma.shift.findFirst({
    where: { employeeId, dayOfWeek, startHour, durationHours, weekKey: weekKey ?? "" },
    include: { employee: { select: EMPLOYEE_SELECT } },
  });
  if (duplicate) return NextResponse.json(duplicate, { status: 200 });

  const shift = await prisma.shift.create({
    data: { employeeId, dayOfWeek, startHour, durationHours, weekKey: weekKey ?? "" },
    include: { employee: { select: EMPLOYEE_SELECT } },
  });
  return NextResponse.json(shift, { status: 201 });
}
