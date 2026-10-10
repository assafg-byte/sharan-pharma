import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Employees only get their own review queue; managers may preview anyone's
  const employeeId = auth.role === "MANAGER" ? Number(req.nextUrl.searchParams.get("employeeId")) : auth.employeeId;
  // Clamp n to [1, 20] — prevents full-table scan and NaN from malformed input
  const rawN = Number(req.nextUrl.searchParams.get("n") ?? "3");
  const n = Number.isFinite(rawN) ? Math.min(Math.max(1, rawN), 20) : 3;

  if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });

  const today = new Date().toISOString().slice(0, 10);

  // Unseen questions (no CampusProgress row) sort first — NULLS FIRST.
  // Then overdue questions (nextReviewDate <= today), oldest first.
  // updatedDate is included (shown to employees on the question card);
  // source is deliberately never selected here — manager-only, never leaked
  // to the employee-facing session endpoint.
  const questions = await prisma.$queryRaw<
    {
      id: number; text: string; type: string;
      optionA: string; optionB: string; optionC: string; optionD: string;
      correctAnswers: string; explanation: string; reportData: unknown;
      updatedDate: string; createdAt: string; updatedAt: string;
    }[]
  >`
    SELECT q.id, q.text, q.type,
           q.optionA, q.optionB, q.optionC, q.optionD,
           q.correctAnswers, q.explanation, q.reportData,
           q.updatedDate, q.createdAt, q.updatedAt
    FROM CampusQuestion q
    LEFT JOIN CampusProgress p
      ON p.questionId = q.id AND p.employeeId = ${employeeId}
    WHERE p.id IS NULL OR p.nextReviewDate <= ${today}
    ORDER BY p.nextReviewDate ASC NULLS FIRST
    LIMIT ${n}
  `;

  // The libsql adapter pre-parses Json columns into objects, but on some
  // setups still returns a raw string — handle both.
  const result = questions.map(q => ({
    ...q,
    reportData: typeof q.reportData === "string" ? JSON.parse(q.reportData) : q.reportData,
  }));

  return NextResponse.json(result);
}
