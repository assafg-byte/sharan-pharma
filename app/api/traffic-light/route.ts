import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { DEFAULT_THRESHOLDS, isValidThresholds, type TrafficLightThresholds } from "@/lib/trafficLight";

// Traffic-light thresholds for the weekly schedule table (Campus → Settings):
// the minimum headcount for orange / yellow / green. Colors themselves are fixed.
// Everyone signed in reads them; only managers change them.

function toThresholds(c: { oneMin: number; twoMin: number; fullMin: number }): TrafficLightThresholds {
  return { one: c.oneMin, two: c.twoMin, full: c.fullMin };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const config = await prisma.trafficLightConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return NextResponse.json(toThresholds(config));
}

// PATCH { one, two, full } — all three together so the ascending order can be
// validated as a whole. { reset: true } restores the defaults (1 / 2 / 3).
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const t: unknown = body?.reset === true ? DEFAULT_THRESHOLDS : { one: body?.one, two: body?.two, full: body?.full };
  if (!isValidThresholds(t)) {
    return NextResponse.json({ error: "thresholds must be integers with 1 ≤ one < two < full ≤ 20" }, { status: 400 });
  }

  const data = { oneMin: t.one, twoMin: t.two, fullMin: t.full };
  const config = await prisma.trafficLightConfig.upsert({
    where: { id: 1 }, update: data, create: { id: 1, ...data },
  });
  return NextResponse.json(toThresholds(config));
}
