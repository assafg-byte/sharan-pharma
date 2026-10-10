import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // A session is always opened for the signed-in employee, never someone else
  const { date } = await req.json();
  if (typeof date !== "string" || !date) return NextResponse.json({ error: "date required" }, { status: 400 });
  const session = await prisma.campusSession.create({
    data: { employeeId: auth.employeeId, date },
  });
  return NextResponse.json(session, { status: 201 });
}

export async function GET(req: NextRequest) {
  // Learning results of the whole team — manager-only (an employee may read only her own)
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const employeeId = auth.role === "MANAGER" ? req.nextUrl.searchParams.get("employeeId") : String(auth.employeeId);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [sessions, abandonedCount] = await Promise.all([
    prisma.campusSession.findMany({
      where: employeeId ? { employeeId: Number(employeeId) } : undefined,
      include: {
        employee: { select: { id: true, name: true, color: true } },
        attempts: {
          include: { question: { select: { id: true, text: true } } },
          orderBy: { answeredAt: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
    }),
    prisma.campusSession.count({
      where: {
        completedAt: null,
        startedAt: { lt: cutoff },
      },
    }),
  ]);

  return NextResponse.json({ sessions, abandonedCount });
}
