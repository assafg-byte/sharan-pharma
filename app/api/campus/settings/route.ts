import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

const SINGLETON_ID = 1;
const DEFAULTS = { id: SINGLETON_ID, enabled: false, questionsPerSession: 3 };

export async function GET() {
  const settings = await prisma.campusSettings.upsert({
    where: { id: SINGLETON_ID },
    create: DEFAULTS,
    update: {},
  });
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  // Manager-only: these settings gate what employees can see (e.g. the
  // Mounjaro leaflet lock), so an employee must not be able to flip them.
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();

  // Bug 9: whitelist the permitted fields — reject arbitrary keys so a
  // buggy client cannot attempt to overwrite the primary key or other fields.
  const update: { enabled?: boolean; questionsPerSession?: number; leafletLocked?: boolean } = {};
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.leafletLocked === "boolean") update.leafletLocked = body.leafletLocked;
  if (typeof body.questionsPerSession === "number" && body.questionsPerSession >= 1 && body.questionsPerSession <= 20) {
    update.questionsPerSession = body.questionsPerSession;
  }

  const settings = await prisma.campusSettings.upsert({
    where:  { id: SINGLETON_ID },
    create: { ...DEFAULTS, ...update },
    update,
  });
  return NextResponse.json(settings);
}
