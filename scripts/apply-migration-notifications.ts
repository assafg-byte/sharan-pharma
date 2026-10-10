/**
 * Idempotent migration: create the TaskView, DayNote and Notification tables
 * (per-item notification feed, manager day notes, per-employee task views).
 * Mirrors prisma/migrations/20260916065903_add_day_note_notification_task_view.
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-notifications.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TaskView" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "taskId" INTEGER NOT NULL,
      "employeeId" INTEGER NOT NULL,
      "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TaskView_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "TaskView_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "TaskView_taskId_employeeId_key" ON "TaskView"("taskId", "employeeId")
  `);
  console.log("✓ TaskView table ensured");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "DayNote" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "weekKey" TEXT NOT NULL,
      "dayOfWeek" INTEGER NOT NULL,
      "text" TEXT NOT NULL DEFAULT '',
      "updatedAt" DATETIME NOT NULL
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "DayNote_weekKey_dayOfWeek_key" ON "DayNote"("weekKey", "dayOfWeek")
  `);
  console.log("✓ DayNote table ensured");

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "recipientType" TEXT NOT NULL,
      "recipientId" INTEGER,
      "type" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "entityId" INTEGER,
      "subjectEmployeeId" INTEGER,
      "read" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ Notification table ensured");
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
