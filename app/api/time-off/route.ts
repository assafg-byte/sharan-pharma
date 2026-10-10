import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Employees only see their own requests; managers may filter by anyone
  const employeeId = auth.role === "MANAGER" ? req.nextUrl.searchParams.get("employeeId") : String(auth.employeeId);
  const status = req.nextUrl.searchParams.get("status");
  const requests = await prisma.timeOffRequest.findMany({
    where: {
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      ...(status ? { status } : {}),
    },
    include: { employee: { select: { id: true, name: true, color: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(requests);
}

const TYPE_LABELS: Record<string, string> = { FULL_DAY: "יום שלם", HALF_DAY: "חצי יום", PART_TIME: "חלקי" };
const fmt = (d: string) => d.split("-").reverse().join("/");

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { employeeId, date, toDate, type, notes } = await req.json();
  if (auth.role !== "MANAGER" && Number(employeeId) !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!Number.isInteger(Number(employeeId)) || typeof date !== "string" || !date) {
    return NextResponse.json({ error: "employeeId and date are required" }, { status: 400 });
  }
  const request = await prisma.timeOffRequest.create({
    data: { employeeId, date, toDate: toDate ?? null, type: type ?? "FULL_DAY", notes: notes ?? "" },
    include: { employee: { select: { id: true, name: true, color: true } } },
  });

  // Manager notification — resolved (marked read) when the request is decided
  await prisma.notification.create({
    data: {
      recipientType: "MANAGER", recipientId: null, type: "TIME_OFF_PENDING",
      description: `${request.employee.name} ביקש/ה חופש (${TYPE_LABELS[request.type] ?? request.type}) ל-${fmt(request.date)}${request.toDate ? ` עד ${fmt(request.toDate)}` : ""}`,
      entityId: request.id, subjectEmployeeId: request.employeeId,
    },
  }).catch(() => { /* never fail the request over a notification */ });

  return NextResponse.json(request, { status: 201 });
}
