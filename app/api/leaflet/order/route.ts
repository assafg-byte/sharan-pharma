import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const employeeId = Number(req.nextUrl.searchParams.get("employeeId"));
  if (!employeeId) return NextResponse.json({ orders: [] });
  const rows = await prisma.leafletTopicOrder.findMany({
    where: { employeeId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ orders: rows.map(r => ({ topicKey: r.topicKey, order: r.order })) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { employeeId, orders } = await req.json() as {
    employeeId: number;
    orders: { topicKey: string; order: number }[];
  };

  // delete-then-insert to handle any removed keys cleanly
  await prisma.leafletTopicOrder.deleteMany({ where: { employeeId } });
  await prisma.leafletTopicOrder.createMany({
    data: orders.map(o => ({ employeeId, topicKey: o.topicKey, order: o.order })),
  });

  return NextResponse.json({ ok: true });
}
