import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// Kept alive by cron — runs a cheap query so Prisma + Turso stay connected
export async function GET() {
  await prisma.employee.count();
  return NextResponse.json({ ok: true, ts: Date.now() });
}
