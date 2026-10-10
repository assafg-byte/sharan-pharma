import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Accept date from client to avoid server-timezone issues
  const dateParam = req.nextUrl.searchParams.get("date");
  const today = dateParam ?? new Date().toISOString().slice(0, 10);

  // Parse at noon UTC so getUTCDay() returns the same calendar day the client sees,
  // regardless of server timezone. Must NOT use new Date().getDay() — server is UTC
  // and returns the wrong weekday during early-morning Israel hours.
  const todayUTC = new Date(today + "T12:00:00Z");
  const dow = todayUTC.getUTCDay();

  // Compute this week's Sunday (weekKey) from the client-supplied date.
  // Without this filter, the query returns shifts from EVERY week that has a match
  // for dayOfWeek, making hasShiftToday true for employees who aren't scheduled this week.
  const weekKeyDate = new Date(todayUTC);
  weekKeyDate.setUTCDate(todayUTC.getUTCDate() - dow);
  const weekKey = weekKeyDate.toISOString().slice(0, 10);

  // Fetch all employees (non-manager) with their today shifts and attendance
  const employees = await prisma.employee.findMany({
    where: { role: "EMPLOYEE", archived: false },
    select: {
      id: true,
      name: true,
      color: true,
      shifts: {
        where: { dayOfWeek: dow, weekKey },
        select: { id: true, startHour: true, durationHours: true, weekKey: true },
      },
      attendance: {
        where: { date: today },
        include: { breaks: { orderBy: { breakStart: "asc" } } },
        orderBy: { id: "desc" },
        take: 1,
      },
    },
  });

  const result = employees.map(e => {
    const att = e.attendance[0] ?? null;
    let status: "not-in" | "clocked-in" | "on-break" | "clocked-out" = "not-in";
    if (att) {
      if (att.checkOutTime) {
        status = "clocked-out";
      } else {
        const hasActiveBreak = att.breaks.some(b => !b.breakEnd);
        status = hasActiveBreak ? "on-break" : "clocked-in";
      }
    }
    return {
      employee: { id: e.id, name: e.name, color: e.color },
      attendance: att,
      status,
      hasShiftToday: e.shifts.length > 0,
      shiftDurationHours: e.shifts[0]?.durationHours ?? null,
      shiftStartHour: e.shifts[0]?.startHour ?? null,
    };
  });

  return NextResponse.json(result);
}
