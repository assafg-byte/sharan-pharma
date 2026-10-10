/**
 * Idempotent cleanup: delete exact-duplicate shifts (same employee, week,
 * day, start hour AND duration), keeping the oldest row of each group.
 * Exact duplicates are always bugs — the edit UI blocks creating them —
 * they appeared when copy-prev-week could be clicked repeatedly while the
 * copied shifts were hidden by the archived-employee display filter.
 * Runs as a Vercel build step — safe to re-run (deletes nothing when clean).
 * Local: npx tsx scripts/cleanup-duplicate-shifts.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM "Shift" WHERE id NOT IN (
      SELECT MIN(id) FROM "Shift"
      GROUP BY employeeId, weekKey, dayOfWeek, startHour, durationHours
    )
  `);
  console.log(deleted > 0
    ? `✓ Removed ${deleted} duplicate shift(s)`
    : "✓ No duplicate shifts found");
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
