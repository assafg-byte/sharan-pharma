/**
 * Threshold-crossing sweeps that materialize manager notifications.
 * Both are idempotent per (type, entityId, subjectEmployeeId): a notification
 * is created once and then simply sits in the manager's list until read.
 * Called from GET /api/notifications/manager (polled every 60s by the UI),
 * so there's no cron — the sweep runs whenever a manager is looking.
 */
import { prisma } from "@/lib/db";

export const TASK_DUE_SOON_DAYS = 3;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function alreadyNotified(type: string, entityId: number, subjectEmployeeId: number | null) {
  const existing = await prisma.notification.findFirst({
    where: { type, entityId, subjectEmployeeId },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Campus sessions started >24h ago and never completed → one notification per
 * (employee, date). An employee can leave several sessions open on the same
 * day (e.g. re-opening the site); those used to produce identical duplicate
 * alerts, so any already-notified session in the group covers the others.
 */
export async function sweepAbandonedSessions() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const abandoned = await prisma.campusSession.findMany({
    where: { completedAt: null, startedAt: { lt: cutoff } },
    include: { employee: { select: { name: true } } },
    orderBy: { startedAt: "asc" },
  });
  const notifiedSessionIds = new Set(
    (await prisma.notification.findMany({
      where: { type: "SESSION_ABANDONED", entityId: { in: abandoned.map(s => s.id) } },
      select: { entityId: true },
    })).map(n => n.entityId)
  );
  const groupKey = (s: { employeeId: number; date: string }) => `${s.employeeId}|${s.date}`;
  const coveredGroups = new Set(abandoned.filter(s => notifiedSessionIds.has(s.id)).map(groupKey));

  for (const s of abandoned) {
    if (coveredGroups.has(groupKey(s))) continue;
    coveredGroups.add(groupKey(s));
    await prisma.notification.create({
      data: {
        recipientType: "MANAGER", recipientId: null, type: "SESSION_ABANDONED",
        description: `${s.employee.name} לא סיים/ה סבב לימוד קמפוס מ-${s.date.split("-").reverse().join("/")}`,
        entityId: s.id, subjectEmployeeId: s.employeeId,
      },
    });
  }
}

/**
 * Open tasks due within TASK_DUE_SOON_DAYS (or already overdue) that an
 * assignee has never viewed → one notification per (task, employee).
 * No lower date bound on purpose: a task that slipped past its deadline while
 * unviewed still deserves the alert; the dedupe check is what enforces "once".
 */
export async function sweepTaskDueUnviewed() {
  const soon = new Date();
  soon.setDate(soon.getDate() + TASK_DUE_SOON_DAYS);
  const soonStr = localDateStr(soon);

  const candidates = await prisma.task.findMany({
    where: { status: { not: "DONE" }, dueDate: { lte: soonStr, not: "" } },
    include: { views: { select: { employeeId: true } } },
  });

  for (const task of candidates) {
    const assigneeIds = task.assigneeIds.split(",").filter(Boolean).map(Number).filter(Number.isFinite);
    if (assigneeIds.length === 0) continue;
    const viewed = new Set(task.views.map(v => v.employeeId));
    for (const empId of assigneeIds) {
      if (viewed.has(empId)) continue;
      if (await alreadyNotified("TASK_DUE_UNVIEWED", task.id, empId)) continue;
      const emp = await prisma.employee.findUnique({ where: { id: empId }, select: { name: true } });
      if (!emp) continue;
      await prisma.notification.create({
        data: {
          recipientType: "MANAGER", recipientId: null, type: "TASK_DUE_UNVIEWED",
          description: `${emp.name} עדיין לא צפה/תה במשימה "${task.title}" — תאריך היעד ${task.dueDate.split("-").reverse().join("/")}`,
          entityId: task.id, subjectEmployeeId: empId,
        },
      });
    }
  }
}
