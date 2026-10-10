/**
 * API smoke tests — run against the live dev server (localhost:3000).
 *
 * Two categories:
 *   @known-vulnerability  — tests that currently PASS but SHOULD fail (security gaps)
 *   @expected-pass        — business logic that should already work correctly
 *
 * Run the dev server first: npm run dev
 */

import { describe, it, expect, beforeAll } from "vitest";

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

async function get(path: string) {
  return fetch(`${BASE}${path}`);
}
async function post(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function del(path: string) {
  return fetch(`${BASE}${path}`, { method: "DELETE" });
}
async function patch(path: string, body: unknown) {
  return fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── @known-vulnerability — API routes accessible without authentication ────────
describe("@known-vulnerability — Unauthenticated API access", () => {
  it("GET /api/employees returns data without auth token", async () => {
    const res = await get("/api/employees");
    // Documents that this SHOULD be 401 but is currently 200
    expect(res.status).toBe(200); // vulnerability: should be 401
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/tasks returns all tasks without auth token", async () => {
    const res = await get("/api/tasks");
    expect(res.status).toBe(200); // vulnerability: should be 401
  });

  it("GET /api/attendance returns all attendance without auth token", async () => {
    const res = await get("/api/attendance");
    expect(res.status).toBe(200); // vulnerability: should be 401
  });

  it("GET /api/schedule returns employees+shifts without auth token", async () => {
    const res = await get("/api/schedule?weekKey=2026-05-17");
    expect(res.status).toBe(200); // vulnerability: should be 401
    const data = await res.json();
    expect(data).toHaveProperty("employees");
    expect(data).toHaveProperty("shifts");
  });
});

// ── @known-vulnerability — No input validation ────────────────────────────────
describe("@known-vulnerability — Missing input validation", () => {
  it("POST /api/tasks with no title crashes with 500 instead of 400", async () => {
    const res = await post("/api/tasks", {});
    // Documents that this SHOULD be 400 but is currently 500 (Prisma error)
    expect([400, 500]).toContain(res.status); // known: currently 500
  });

  it("DELETE /api/employees/abc (NaN id) crashes with 500 instead of 400", async () => {
    const res = await del("/api/employees/abc");
    // Documents that this SHOULD be 400 but is currently 500 (Prisma crash)
    expect([400, 500]).toContain(res.status);
  });

  it("POST /api/attendance with no employeeId causes FK error (500 not 400)", async () => {
    const res = await post("/api/attendance", { date: "2026-05-17" });
    expect([400, 500]).toContain(res.status);
  });

  it("POST /api/shifts with invalid dayOfWeek=9 is accepted (no validation)", async () => {
    // Get a real employee ID first
    const empsRes = await get("/api/employees");
    const emps = await empsRes.json();
    if (emps.length === 0) { console.warn("No employees — skipping"); return; }

    const res = await post("/api/shifts", {
      employeeId: emps[0].id,
      dayOfWeek: 9, // invalid: should be 0-4
      startHour: 8,
      durationHours: 2,
      weekKey: "2026-05-17",
    });
    // Documents: currently accepts invalid dayOfWeek=9 without error
    expect(res.status).toBe(201); // vulnerability: should be 400
    // Clean up
    const created = await res.json();
    if (created.id) await del(`/api/shifts/${created.id}`);
  });
});

// ── @expected-pass — Setup endpoint ──────────────────────────────────────────
describe("@expected-pass — Setup endpoint", () => {
  it("POST /api/setup rejects a second manager with 409", async () => {
    // First call: creates if none exists, or gets 409 if one already does
    const first = await post("/api/setup", { phone4: "9876", password: "testpass", name: "Test Manager" });
    // Second call must always be 409
    const second = await post("/api/setup", { phone4: "9875", password: "testpass2", name: "Another Manager" });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body).toHaveProperty("error");
  });
});

// ── @expected-pass — Business logic ──────────────────────────────────────────
describe("@expected-pass — Schedule API", () => {
  it("GET /api/schedule returns correct shape", async () => {
    const res = await get("/api/schedule?weekKey=2026-05-17");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("employees");
    expect(data).toHaveProperty("shifts");
    expect(Array.isArray(data.employees)).toBe(true);
    expect(Array.isArray(data.shifts)).toBe(true);
  });

  it("GET /api/schedule with unknown weekKey returns empty shifts", async () => {
    const res = await get("/api/schedule?weekKey=1990-01-01");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.shifts).toHaveLength(0);
  });
});

describe("@expected-pass — Time-off requests", () => {
  it("GET /api/time-off returns array", async () => {
    const res = await get("/api/time-off");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("GET /api/time-off?status=PENDING returns only pending", async () => {
    const res = await get("/api/time-off?status=PENDING");
    expect(res.status).toBe(200);
    const data = await res.json();
    data.forEach((r: { status: string }) => expect(r.status).toBe("PENDING"));
  });

  it("GET /api/time-off?status=APPROVED returns only approved", async () => {
    const res = await get("/api/time-off?status=APPROVED");
    expect(res.status).toBe(200);
    const data = await res.json();
    data.forEach((r: { status: string }) => expect(r.status).toBe("APPROVED"));
  });
});

describe("@expected-pass — Availability", () => {
  it("GET /api/availability without employeeId returns 400", async () => {
    const res = await get("/api/availability");
    expect(res.status).toBe(400);
  });

  it("POST /api/availability with empty slots clears availability", async () => {
    const empsRes = await get("/api/employees");
    const emps = await empsRes.json();
    if (emps.length === 0) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const res = await post("/api/availability", { employeeId: empId, slots: [] });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(0);
  });

  it("POST /api/availability then GET returns same slots", async () => {
    const empsRes = await get("/api/employees");
    const emps = await empsRes.json();
    if (emps.length === 0) { console.warn("No employees — skipping"); return; }

    const empId = emps[0].id;
    const slots = [
      { dayOfWeek: 0, startHour: 9, endHour: 10, available: true },
      { dayOfWeek: 1, startHour: 10, endHour: 11, available: false },
    ];

    await post("/api/availability", { employeeId: empId, slots });
    const getRes = await get(`/api/availability?employeeId=${empId}`);
    const saved = await getRes.json();
    expect(saved).toHaveLength(2);
    // Clean up
    await post("/api/availability", { employeeId: empId, slots: [] });
  });
});
