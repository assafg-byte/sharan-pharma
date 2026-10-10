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
  const [employees, shifts] = await Promise.all([
    // Archived employees are hidden from the roster; their historic shifts
    // still render via each shift's embedded `employee`.
    prisma.employee.findMany({
      where: { archived: false },
      orderBy: { id: "asc" },
      select: EMPLOYEE_SELECT,
    }),
    prisma.shift.findMany({
      where: weekKey ? { weekKey } : undefined,
      include: { employee: { select: EMPLOYEE_SELECT } },
      orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
    }),
  ]);
  return NextResponse.json({ employees, shifts });
}
