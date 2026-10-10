import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

const VALID_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

// Managers may change any task; employees only tasks assigned to them
async function canTouchTask(auth: { role: string; employeeId: number }, taskId: number): Promise<boolean> {
  if (!Number.isInteger(taskId)) return false;
  if (auth.role === "MANAGER") return true;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { assigneeIds: true } });
  return !!task && task.assigneeIds.split(",").includes(String(auth.employeeId));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = Number(id);
  if (!(await canTouchTask(auth, taskId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Bug 7: whitelist mutable fields — raw data spread allowed injecting
  // createdAt or other server-owned fields
  const { title, description, dueDate, priority, status, order, assigneeIds } = await req.json();
  const update: Record<string, unknown> = {};
  if (title       !== undefined) update.title       = title;
  if (description !== undefined) update.description = description;
  if (dueDate     !== undefined) update.dueDate     = dueDate;
  if (order       !== undefined) update.order       = Number(order);
  if (assigneeIds !== undefined) update.assigneeIds = assigneeIds;
  if (priority    !== undefined && VALID_PRIORITIES.includes(priority)) update.priority = priority;
  if (status      !== undefined && VALID_STATUSES.includes(status))     update.status   = status;

  // Read the prior status first so we only notify on a genuine TODO/IN_PROGRESS → DONE
  // transition, not every PATCH that happens to already be DONE.
  const before = update.status === "DONE"
    ? await prisma.task.findUnique({ where: { id: taskId }, select: { status: true, title: true } })
    : null;

  const task = await prisma.task.update({ where: { id: taskId }, data: update });

  // Manager notification — mirrors TASK_VIEWED: only an employee finishing her
  // own task counts (not a manager dragging a card on someone else's behalf).
  if (before && before.status !== "DONE" && auth.role !== "MANAGER") {
    await prisma.notification.create({
      data: {
        recipientType: "MANAGER", recipientId: null, type: "TASK_COMPLETED",
        description: `${auth.name} ${auth.gender === "F" ? "סיימה" : "סיים"} את המשימה "${before.title}"`,
        entityId: taskId, subjectEmployeeId: auth.employeeId,
      },
    }).catch(() => { /* never fail the update over a notification */ });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canTouchTask(auth, Number(id)))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await prisma.task.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
