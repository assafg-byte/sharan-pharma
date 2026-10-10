import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// Mark one notification read/unread. Anyone may only touch their own:
// managers own the shared MANAGER inbox, employees own rows addressed to them.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const notif = await prisma.notification.findUnique({ where: { id: Number(id) } });
  if (!notif) return NextResponse.json({ error: "not found" }, { status: 404 });

  const owns = notif.recipientType === "MANAGER"
    ? auth.role === "MANAGER"
    : notif.recipientType === "EMPLOYEE" && notif.recipientId === auth.employeeId;
  if (!owns) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { read } = await req.json();
  const updated = await prisma.notification.update({
    where: { id: notif.id },
    data: { read: read !== false },
  });
  return NextResponse.json(updated);
}
