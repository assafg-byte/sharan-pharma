import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";
import { sweepAbandonedSessions, sweepTaskDueUnviewed } from "@/lib/notificationSweep";

// Manager notification feed. Runs the threshold sweeps first so anything that
// crossed a line since the last poll (task due soon & unviewed, abandoned
// campus session) shows up in the same response.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Sweeps are best-effort — a failure must not blank the existing feed
  await Promise.allSettled([sweepTaskDueUnviewed(), sweepAbandonedSessions()]);

  const notifications = await prisma.notification.findMany({
    where: { recipientType: "MANAGER", cleared: false },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
  });
}

// "נקה היסטוריה" — empties the manager's whole notification list (read and
// unread alike). A deliberate, confirmed action distinct from "mark as read".
// Rows are hidden, not deleted: the sweeps dedupe against existing rows, so
// deleting them made every still-abandoned session / still-unviewed task pop
// straight back up as a fresh unread notification on the next poll.
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.notification.updateMany({
    where: { recipientType: "MANAGER", cleared: false },
    data: { cleared: true, read: true },
  });
  return NextResponse.json({ ok: true });
}
