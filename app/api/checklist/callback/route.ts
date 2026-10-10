import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fired from the daily checklist's "patients to call back" question when the
// employee answers yes and enters a count — notifies the manager once.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { count } = await req.json();
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1) {
    return NextResponse.json({ error: "count must be a positive integer" }, { status: 400 });
  }

  const today = new Date();
  const dateStr = localDateStr(today);
  const dateLabel = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
  const verb = auth.gender === "F" ? "שהיא צריכה" : "שהוא צריך";

  const notification = await prisma.notification.create({
    data: {
      recipientType: "MANAGER", recipientId: null, type: "PATIENT_CALLBACK",
      description: `ל${auth.name} היום ${dateLabel} יש ${n} מטופלים ${verb} לחזור אליהם`,
      entityId: null, subjectEmployeeId: auth.employeeId,
    },
  });
  return NextResponse.json({ ok: true, notification, date: dateStr }, { status: 201 });
}
