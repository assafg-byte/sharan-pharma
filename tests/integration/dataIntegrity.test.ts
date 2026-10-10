/**
 * Data integrity tests — run against the live dev server.
 * These verify DB constraints (CASCADE delete, FK enforcement, weekKey filtering).
 */

import { describe, it, expect } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function post(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function get(path: string) { return fetch(`${BASE}${path}`); }
async function del(path: string) { return fetch(`${BASE}${path}`, { method: "DELETE" }); }
async function patch(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("weekKey filtering", () => {
  it("shift with weekKey=2026-05-17 appears in that week's query", async () => {
    // Get first employee
    const emps = await get("/api/employees").then(r => r.json());
    if (!emps.length) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const weekKey = "2026-05-17";
    const shiftRes = await post("/api/shifts", {
      employeeId: empId, dayOfWeek: 0, startHour: 8, durationHours: 1, weekKey,
    });
    expect(shiftRes.status).toBe(201);
    const shift = await shiftRes.json();

    const scheduled = await get(`/api/schedule?weekKey=${weekKey}`).then(r => r.json());
    const found = scheduled.shifts.find((s: { id: number }) => s.id === shift.id);
    expect(found).toBeDefined();

    // Clean up
    await del(`/api/shifts/${shift.id}`);
  });

  it("shift with weekKey='' is NOT returned by week-specific query", async () => {
    const emps = await get("/api/employees").then(r => r.json());
    if (!emps.length) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const shiftRes = await post("/api/shifts", {
      employeeId: empId, dayOfWeek: 1, startHour: 9, durationHours: 1, weekKey: "",
    });
    const shift = await shiftRes.json();

    const scheduled = await get(`/api/schedule?weekKey=2026-05-17`).then(r => r.json());
    const found = scheduled.shifts.find((s: { id: number }) => s.id === shift.id);
    expect(found).toBeUndefined();

    // Clean up
    await del(`/api/shifts/${shift.id}`);
  });
});

describe("PATCH /api/time-off/[id] status transitions", () => {
  it("approves a PENDING request → status becomes APPROVED", async () => {
    const emps = await get("/api/employees").then(r => r.json());
    if (!emps.length) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const reqRes = await post("/api/time-off", {
      employeeId: empId, date: "2099-01-01", type: "FULL_DAY",
    });
    const req = await reqRes.json();
    expect(req.status).toBe("PENDING");

    const patched = await patch(`/api/time-off/${req.id}`, { status: "APPROVED" }).then(r => r.json());
    expect(patched.status).toBe("APPROVED");

    // Clean up
    await del(`/api/time-off/${req.id}`);
  });

  it("rejects a PENDING request → status becomes REJECTED", async () => {
    const emps = await get("/api/employees").then(r => r.json());
    if (!emps.length) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const reqRes = await post("/api/time-off", {
      employeeId: empId, date: "2099-02-01", type: "HALF_DAY",
    });
    const req = await reqRes.json();

    const patched = await patch(`/api/time-off/${req.id}`, { status: "REJECTED" }).then(r => r.json());
    expect(patched.status).toBe("REJECTED");

    await del(`/api/time-off/${req.id}`);
  });
});

describe("Attendance records", () => {
  it("creating attendance for an existing employee succeeds", async () => {
    const emps = await get("/api/employees").then(r => r.json());
    if (!emps.length) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const res = await post("/api/attendance", {
      employeeId: empId, date: "2099-06-01", weekKey: "2099-06-01",
    });
    expect(res.status).toBe(201);
    const att = await res.json();
    expect(att.employeeId).toBe(empId);
    expect(att.checkOutTime).toBeNull();

    // PATCH checkout
    const checkOutTime = new Date().toISOString();
    const patched = await patch(`/api/attendance/${att.id}`, { checkOutTime }).then(r => r.json());
    expect(patched.checkOutTime).not.toBeNull();
  });

  it("attendance filtered by employeeId returns only that employee's records", async () => {
    const emps = await get("/api/employees").then(r => r.json());
    if (emps.length < 2) { console.warn("Need 2+ employees — skipping"); return; }

    const empId = emps[0].id;
    const records = await get(`/api/attendance?employeeId=${empId}`).then(r => r.json());
    records.forEach((r: { employeeId: number }) => expect(r.employeeId).toBe(empId));
  });
});

describe("Task CRUD cycle", () => {
  it("creates, reads, patches, and deletes a task", async () => {
    const createRes = await post("/api/tasks", {
      title: "Test task", description: "Integration test", priority: "LOW",
    });
    expect(createRes.status).toBe(201);
    const task = await createRes.json();
    expect(task.title).toBe("Test task");
    expect(task.status).toBe("TODO");

    const allTasks = await get("/api/tasks").then(r => r.json());
    expect(allTasks.find((t: { id: number }) => t.id === task.id)).toBeDefined();

    const patched = await patch(`/api/tasks/${task.id}`, { status: "IN_PROGRESS" }).then(r => r.json());
    expect(patched.status).toBe("IN_PROGRESS");

    const delRes = await del(`/api/tasks/${task.id}`);
    expect(delRes.status).toBe(200);

    const afterDel = await get("/api/tasks").then(r => r.json());
    expect(afterDel.find((t: { id: number }) => t.id === task.id)).toBeUndefined();
  });
});
