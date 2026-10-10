import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tasks = await prisma.task.findMany({ orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }] });
  // Employees only see tasks assigned to them; managers see the whole board
  if (auth.role !== "MANAGER") {
    const me = String(auth.employeeId);
    return NextResponse.json(tasks.filter(t => t.assigneeIds.split(",").includes(me)));
  }
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { title, description, dueDate, priority, status, order, assigneeIds } = await req.json();
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? "",
      dueDate: dueDate ?? "",
      priority: priority ?? "MEDIUM",
      status: status ?? "TODO",
      order: order ?? 0,
      assigneeIds: assigneeIds ?? "",
    },
  });
  return NextResponse.json(task, { status: 201 });
}
