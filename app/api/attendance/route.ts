import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Employees only ever see their own records; managers may query anyone (or everyone)
  const employeeId = auth.role === "MANAGER"
    ? req.nextUrl.searchParams.get("employeeId")
    : String(auth.employeeId);
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const records = await prisma.attendance.findMany({
    where: {
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
    },
    include: { breaks: { orderBy: { breakStart: "asc" } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(records);
}

export async function POST(req: NextRequest) {
  // Employees may only clock in for themselves; managers may record for anyone
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { employeeId, date, checkInTime, weekKey } = await req.json();
  if (!Number.isInteger(Number(employeeId)) || typeof date !== "string" || !date) {
    return NextResponse.json({ error: "employeeId and date are required" }, { status: 400 });
  }
  if (auth.role !== "MANAGER" && Number(employeeId) !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const record = await prisma.attendance.create({
    data: {
      employeeId,
      date,
      checkInTime: checkInTime ? new Date(checkInTime) : new Date(),
      weekKey: weekKey ?? "",
    },
    include: { breaks: true },
  });
  return NextResponse.json(record, { status: 201 });
}
