import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const owner = await prisma.campusSession.findUnique({ where: { id: Number(id) }, select: { employeeId: true } });
  if (!owner) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (auth.role !== "MANAGER" && owner.employeeId !== auth.employeeId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const session = await prisma.campusSession.update({
    where: { id: Number(id) },
    data: { completedAt: new Date() },
  });
  return NextResponse.json(session);
}
