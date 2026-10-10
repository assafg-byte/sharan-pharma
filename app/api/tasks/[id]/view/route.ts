import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

// Record that the signed-in employee was shown this task (daily popup or
// Kanban). Idempotent: the first view wins, and only a genuinely new view
// notifies the manager — repeat popups / board opens are silent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isInteger(taskId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const existing = await prisma.taskView.findUnique({
    where: { taskId_employeeId: { taskId, employeeId: auth.employeeId } },
  });
  if (existing) return NextResponse.json({ ...existing, created: false });

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });

  const view = await prisma.taskView.create({ data: { taskId, employeeId: auth.employeeId } });

  // Managers viewing tasks aren't "employees seeing their assignment"
  if (auth.role !== "MANAGER") {
    await prisma.notification.create({
      data: {
        recipientType: "MANAGER", recipientId: null, type: "TASK_VIEWED",
        description: `${auth.name} צפה/תה במשימה "${task.title}"`,
        entityId: taskId, subjectEmployeeId: auth.employeeId,
      },
    }).catch(() => {});
  }
  return NextResponse.json({ ...view, created: true }, { status: 201 });
}
