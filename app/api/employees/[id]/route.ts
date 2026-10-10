import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/serverAuth";

/** Count active (non-archived) managers other than the given employee.
 *  Used to prevent archiving/demoting the last remaining manager (lockout). */
async function otherActiveManagers(excludeId: number): Promise<number> {
  return prisma.employee.count({
    where: { role: "MANAGER", archived: false, id: { not: excludeId } },
  });
}

// DELETE = archive (soft delete). History — shifts, attendance, campus
// progress, time-off — is preserved; login is blocked; shifts from the
// current week onward are removed so the schedule stays clean.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const empId = Number(id);
  if (!Number.isInteger(empId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const emp = await prisma.employee.findUnique({ where: { id: empId } });
  if (!emp) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (emp.role === "MANAGER" && (await otherActiveManagers(empId)) === 0) {
    return NextResponse.json(
      { error: "אי אפשר להעביר לארכיון את המנהל האחרון" },
      { status: 409 },
    );
  }

  // Current week's Sunday (local time)
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const y = sunday.getFullYear();
  const m = String(sunday.getMonth() + 1).padStart(2, "0");
  const d = String(sunday.getDate()).padStart(2, "0");
  const currentWeekKey = `${y}-${m}-${d}`;

  await prisma.$transaction([
    prisma.shift.deleteMany({ where: { employeeId: empId, weekKey: { gte: currentWeekKey } } }),
    prisma.employee.update({ where: { id: empId }, data: { archived: true } }),
  ]);
  return NextResponse.json({ ok: true, archived: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const empId = Number(id);
  if (!Number.isInteger(empId)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  // Whitelist permitted fields. `role` and `archived` are manager-gated by the
  // requireAuth above, with a last-manager guard so the org can't lock itself out.
  const { name, color, gender, dateOfBirth, employeeType, phone4, password, role, archived } = await req.json();

  const update: Record<string, unknown> = {};
  if (name         !== undefined) update.name         = name;
  if (color        !== undefined) update.color        = color;
  if (gender       !== undefined) update.gender       = gender;
  if (dateOfBirth  !== undefined) update.dateOfBirth  = dateOfBirth;
  if (employeeType !== undefined) update.employeeType = employeeType;
  if (phone4       !== undefined) update.phone4       = phone4;
  if (password)                   update.passwordHash = await bcrypt.hash(password, 10);
  if (role === "MANAGER" || role === "EMPLOYEE") update.role = role;
  if (archived === false) update.archived = false; // restore from archive

  // Lockout guard: demoting a manager requires another active manager to exist
  if (update.role === "EMPLOYEE") {
    const current = await prisma.employee.findUnique({ where: { id: empId } });
    if (current?.role === "MANAGER" && (await otherActiveManagers(empId)) === 0) {
      return NextResponse.json(
        { error: "אי אפשר להוריד הרשאות למנהל האחרון" },
        { status: 409 },
      );
    }
  }

  const employee = await prisma.employee.update({
    where: { id: empId },
    data: update,
  });
  const { passwordHash: _, ...safe } = employee;
  return NextResponse.json(safe);
}
