import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { DAY_NOTE_MAX_LENGTH } from "@/types";

// Manager notes — one free-text note per weekday per week (top row of the edit grid).
export async function GET(req: NextRequest) {
  const weekKey = req.nextUrl.searchParams.get("weekKey") ?? "";
  const notes = await prisma.dayNote.findMany({
    where: { weekKey },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json(notes);
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { weekKey, dayOfWeek, text } = await req.json();
  const day = Number(dayOfWeek);
  if (typeof weekKey !== "string" || !weekKey || !Number.isInteger(day) || day < 0 || day > 4) {
    return NextResponse.json({ error: "invalid weekKey/dayOfWeek" }, { status: 400 });
  }
  const clean = String(text ?? "").slice(0, DAY_NOTE_MAX_LENGTH);

  const note = await prisma.dayNote.upsert({
    where: { weekKey_dayOfWeek: { weekKey, dayOfWeek: day } },
    update: { text: clean },
    create: { weekKey, dayOfWeek: day, text: clean },
  });
  return NextResponse.json(note);
}
