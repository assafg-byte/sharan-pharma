import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// One-time: create the initial MANAGER account if none exists.
// POST { phone4, password } — only works when no MANAGER exists yet.
export async function POST(req: NextRequest) {
  const existing = await prisma.employee.findFirst({ where: { role: "MANAGER" } });
  if (existing) return NextResponse.json({ error: "Manager already exists" }, { status: 409 });

  const { phone4, password, name } = await req.json();
  if (!phone4 || !password) return NextResponse.json({ error: "phone4 and password required" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 10);
  const manager = await prisma.employee.create({
    data: {
      name: name ?? "מנהל",
      color: "#D7252F",
      phone4,
      passwordHash,
      role: "MANAGER",
      gender: "M",
      employeeType: "FULL_TIME",
    },
  });
  return NextResponse.json({ ok: true, id: manager.id });
}
