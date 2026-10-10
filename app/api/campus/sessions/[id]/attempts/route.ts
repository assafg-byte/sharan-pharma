import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

function addDays(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { questionId, answeredCorrectly, blankAttempts } = await req.json();

  // Attempts are recorded only into the caller's own session, for the caller
  const session = await prisma.campusSession.findUnique({ where: { id: Number(id) }, select: { employeeId: true } });
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (session.employeeId !== auth.employeeId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const employeeId = session.employeeId;

  // Read existing progress to compute the next interval.
  // Growing schedule: 3 → 6 → 12 → 24 → 30 days (cap) for consecutive correct answers.
  // Incorrect always resets to 3 days.
  const existingProgress = await prisma.campusProgress.findUnique({
    where: { employeeId_questionId: { employeeId, questionId } },
    select: { intervalDays: true },
  });

  const intervalDays = answeredCorrectly
    ? existingProgress
      ? Math.min(existingProgress.intervalDays * 2, 30) // double each correct, cap at 30
      : 3                                                // first correct answer: 3 days
    : 3;                                                 // incorrect: always reset to 3

  const nextReviewDate = addDays(intervalDays);

  // Atomic: attempt record + SRS progress update in one transaction.
  const [attempt] = await prisma.$transaction([
    prisma.campusQuestionAttempt.create({
      data: {
        sessionId:        Number(id),
        questionId,
        employeeId,
        answeredCorrectly,
        blankAttempts: blankAttempts ?? undefined,
      },
    }),
    prisma.campusProgress.upsert({
      where:  { employeeId_questionId: { employeeId, questionId } },
      create: { employeeId, questionId, nextReviewDate, intervalDays },
      update: { nextReviewDate, intervalDays },
    }),
  ]);

  // Struggling-question alert — fires once, exactly when the 3rd wrong
  // answer on this specific question lands (not every wrong answer after).
  if (!answeredCorrectly) {
    const wrongCount = await prisma.campusQuestionAttempt.count({
      where: { employeeId, questionId, answeredCorrectly: false },
    });
    if (wrongCount === 3) {
      const [employee, question] = await Promise.all([
        prisma.employee.findUnique({ where: { id: employeeId }, select: { name: true, gender: true } }),
        prisma.campusQuestion.findUnique({ where: { id: questionId }, select: { text: true } }),
      ]);
      if (employee && question) {
        const verb = employee.gender === "F" ? "טעתה" : "טעה";
        await prisma.notification.create({
          data: {
            recipientType: "MANAGER", recipientId: null, type: "QUESTION_STRUGGLE",
            description: `${employee.name} ${verb} 3 פעמים בשאלה: "${question.text}"`,
            entityId: questionId, subjectEmployeeId: employeeId,
          },
        }).catch(() => { /* never fail the attempt over a notification */ });
      }
    }
  }

  return NextResponse.json({ attempt, nextReviewDate, intervalDays }, { status: 201 });
}
