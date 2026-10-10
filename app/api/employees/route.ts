import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Includes archived employees — UI separates them; use `archived` to filter
  const employees = await prisma.employee.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true, name: true, color: true,
      role: true, gender: true, dateOfBirth: true,
      employeeType: true, phone4: true, archived: true,
      // passwordHash never returned
    },
  });
  return NextResponse.json(employees);
}

export async function POST(req: NextRequest) {
  // Bug 3: only managers may create accounts
  const auth = await requireAuth(req, "MANAGER");
  if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Bug 3: whitelist fields — role may only be set to MANAGER by an existing manager,
  // preventing privilege escalation through self-registration
  const { name, color, gender, dateOfBirth, employeeType, phone4, password, role } = await req.json();
  const passwordHash = password ? await bcrypt.hash(password, 10) : "";
  const assignedRole = role === "MANAGER" ? "MANAGER" : "EMPLOYEE";

  const { passwordHash: _, ...safe } = await prisma.employee.create({
    data: {
      name:         name        ?? "",
      color:        color       ?? "#2563EB",
      gender:       gender      ?? "M",
      dateOfBirth:  dateOfBirth ?? "",
      employeeType: employeeType ?? "FULL_TIME",
      phone4:       phone4      ?? "",
      passwordHash,
      role:         assignedRole,
    },
  });
  return NextResponse.json(safe, { status: 201 });
}
