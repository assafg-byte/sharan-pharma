import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// Full question bank incl. correct answers and sources — manager-only.
// Employees get their daily questions through /api/campus/questions/due.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const questions = await prisma.campusQuestion.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(questions);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { text, type, optionA, optionB, optionC, optionD, correctAnswers, explanation, reportData, updatedDate, source } = await req.json();
  const question = await prisma.campusQuestion.create({
    data: {
      text,
      type,
      optionA,
      optionB,
      optionC: optionC ?? "",
      optionD: optionD ?? "",
      correctAnswers,
      explanation: explanation ?? "",
      reportData: reportData ?? undefined,
      // Defaults to today so a freshly-added question always carries a real date
      updatedDate: updatedDate || todayStr(),
      source: source ?? "",
    },
  });
  return NextResponse.json(question, { status: 201 });
}
