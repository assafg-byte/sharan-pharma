/**
 * Idempotent migration: create BreakSlotConfig + BreakSelection tables, add
 * ChecklistItem.countOnYes. Mirrors
 * prisma/migrations/20260916091646_add_break_slots_and_checklist_count.
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-break-slots.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`);
  return rows.some(r => r.name === column);
}

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BreakSlotConfig" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
      "startHour" REAL NOT NULL DEFAULT 12,
      "endHour" REAL NOT NULL DEFAULT 16,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  console.log("✓ BreakSlotConfig table ensured");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BreakSelection" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "employeeId" INTEGER NOT NULL,
      "date" TEXT NOT NULL,
      "startHour" REAL NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "BreakSelection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BreakSelection_date_startHour_key" ON "BreakSelection"("date", "startHour")`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BreakSelection_date_employeeId_key" ON "BreakSelection"("date", "employeeId")`);
  console.log("✓ BreakSelection table ensured");

  if (!(await columnExists("ChecklistItem", "countOnYes"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "ChecklistItem" ADD COLUMN "countOnYes" BOOLEAN NOT NULL DEFAULT false`);
    console.log("✓ Column ChecklistItem.countOnYes added");
  } else {
    console.log("✓ Column ChecklistItem.countOnYes already exists — skipping");
  }

  // One-time data flip: the existing "patients to call back" question should
  // ask for a count. Only runs while no item has the flag yet, so a manager
  // who later turns it off isn't overridden on the next build.
  const flagged = await prisma.checklistItem.count({ where: { countOnYes: true } });
  if (flagged === 0) {
    const r = await prisma.checklistItem.updateMany({
      where: { text: { contains: "מטופלים" }, },
      data: { countOnYes: true },
    });
    console.log(`✓ countOnYes enabled on ${r.count} "patients" checklist item(s)`);
  } else {
    console.log("✓ countOnYes already configured — skipping");
  }

  const configCount = await prisma.breakSlotConfig.count();
  if (configCount === 0) {
    await prisma.breakSlotConfig.create({ data: { id: 1, startHour: 12, endHour: 16 } });
    console.log("✓ Seeded default BreakSlotConfig (12:00–16:00)");
  } else {
    console.log("✓ BreakSlotConfig already present — skipping seed");
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
