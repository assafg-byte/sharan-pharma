import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Employees only see their own availability; the manager's planner reads everyone's
  const employeeId = auth.role === "MANAGER" ? req.nextUrl.searchParams.get("employeeId") : String(auth.employeeId);
  const rows = await prisma.partTimeAvailability.findMany({
    where: employeeId ? { employeeId: Number(employeeId) } : undefined,
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
  });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  // Bulk upsert: replace all availability for this employee.
  // Employees may only write their own availability; managers may write anyone's.
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { employeeId, slots } = await req.json();
  if (auth.role !== "MANAGER" && Number(employeeId) !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Single transaction — a failure mid-way must not wipe existing availability
  await prisma.$transaction([
    prisma.partTimeAvailability.deleteMany({ where: { employeeId } }),
    ...(slots?.length ? [prisma.partTimeAvailability.createMany({
      data: slots.map((s: { dayOfWeek: number; startHour: number; endHour: number; available: boolean }) => ({
        employeeId,
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        endHour: s.endHour,
        available: s.available,
      })),
    })] : []),
  ]);
  const rows = await prisma.partTimeAvailability.findMany({ where: { employeeId } });

  // An employee updating their own availability is something the manager
  // should hear about; a manager editing on their behalf is not.
  if (auth.role !== "MANAGER") {
    await prisma.notification.create({
      data: {
        recipientType: "MANAGER", recipientId: null, type: "AVAILABILITY_UPDATED",
        description: `${auth.name} עדכן/ה זמינות שבועית`,
        entityId: null, subjectEmployeeId: Number(employeeId),
      },
    }).catch(() => {});
  }
  return NextResponse.json(rows);
}
