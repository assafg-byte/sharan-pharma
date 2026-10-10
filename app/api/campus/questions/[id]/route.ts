import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  // Bug 7: whitelist editable fields — raw spread allowed overwriting createdAt
  // and could corrupt correctAnswers, breaking SRS scoring for all employees
  const { text, type, optionA, optionB, optionC, optionD, correctAnswers, explanation, reportData, updatedDate, source } = await req.json();
  const update: Record<string, unknown> = {};
  if (text           !== undefined) update.text           = text;
  if (type           !== undefined) update.type           = type;
  if (optionA        !== undefined) update.optionA        = optionA;
  if (optionB        !== undefined) update.optionB        = optionB;
  if (optionC        !== undefined) update.optionC        = optionC ?? "";
  if (optionD        !== undefined) update.optionD        = optionD ?? "";
  if (correctAnswers !== undefined) update.correctAnswers = correctAnswers;
  if (explanation    !== undefined) update.explanation    = explanation;
  if (reportData     !== undefined) update.reportData     = reportData;
  if (updatedDate    !== undefined) update.updatedDate    = updatedDate ?? "";
  if (source         !== undefined) update.source         = source ?? "";

  const question = await prisma.campusQuestion.update({
    where: { id: Number(id) },
    data: update,
  });
  return NextResponse.json(question);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.campusQuestion.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
