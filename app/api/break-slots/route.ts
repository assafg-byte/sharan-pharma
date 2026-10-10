import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

const EMP_SELECT = { id: true, name: true, color: true } as const;

// GET ?date=YYYY-MM-DD — the break window + who holds which slot that day,
// plus the caller's own pick (if any) and every employee who clocked in that
// day. Used by both the checklist picker and the display-mode break bar.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const [config, selections, checkedIn] = await Promise.all([
    prisma.breakSlotConfig.upsert({
      where: { id: 1 }, update: {}, create: { id: 1, startHour: 12, endHour: 16 },
    }),
    prisma.breakSelection.findMany({
      where: { date },
      include: { employee: { select: EMP_SELECT } },
      orderBy: { startHour: "asc" },
    }),
    // Clocked in today = went through the entry flow (clock-in → checklist).
    // Lets the break bar show someone who has no shift row today — e.g. a
    // full-timer added to a week that already had shifts, so the default
    // Sun–Thu auto-fill never ran for her.
    prisma.employee.findMany({
      where: { role: "EMPLOYEE", archived: false, attendance: { some: { date } } },
      select: EMP_SELECT,
      orderBy: { id: "asc" },
    }),
  ]);

  return NextResponse.json({
    config: { startHour: config.startHour, endHour: config.endHour },
    taken: selections.map(s => ({
      startHour: s.startHour,
      employeeId: s.employeeId,
      employeeName: s.employee.name,
      employeeColor: s.employee.color,
    })),
    mine: selections.find(s => s.employeeId === auth.employeeId)?.startHour ?? null,
    checkedIn,
  });
}

// POST { date, startHour } — pick or move the caller's own break slot.
// First-come-first-served: a slot already held by someone else 409s with
// their name so the UI can show "X already picked this time".
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { date, startHour } = await req.json();
  const hour = Number(startHour);
  if (typeof date !== "string" || !date || !Number.isFinite(hour) || Math.round(hour * 2) !== hour * 2) {
    return NextResponse.json({ error: "invalid date/startHour" }, { status: 400 });
  }

  const config = await prisma.breakSlotConfig.upsert({
    where: { id: 1 }, update: {}, create: { id: 1, startHour: 12, endHour: 16 },
  });
  if (hour < config.startHour || hour > config.endHour - 0.5) {
    return NextResponse.json({ error: "slot outside the configured break window" }, { status: 400 });
  }

  try {
    const selection = await prisma.breakSelection.upsert({
      where: { date_employeeId: { date, employeeId: auth.employeeId } },
      update: { startHour: hour },
      create: { date, employeeId: auth.employeeId, startHour: hour },
    });
    return NextResponse.json(selection);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2002") {
      const holder = await prisma.breakSelection.findUnique({
        where: { date_startHour: { date, startHour: hour } },
        include: { employee: { select: { name: true } } },
      });
      return NextResponse.json(
        { error: "slot_taken", takenByName: holder?.employee.name ?? null },
        { status: 409 }
      );
    }
    throw e;
  }
}

// DELETE ?date=YYYY-MM-DD — clear the caller's own break pick for that day
// ("decide later" / un-picking). Always succeeds even if nothing was set.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  await prisma.breakSelection.deleteMany({ where: { date, employeeId: auth.employeeId } });
  return NextResponse.json({ ok: true });
}
