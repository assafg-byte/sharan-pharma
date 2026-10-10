/**
 * Idempotent migration: add reportData / blankAttempts JSON columns
 * for the REPORT_DRAG_DROP question type.
 * Runs as a Vercel build step — safe to re-run (no-ops if columns exist).
 * Local: npx tsx scripts/apply-migration-report-drag-drop.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function addColumn(table: string, ddl: string, column: string) {
  try {
    await prisma.$executeRawUnsafe(ddl);
    console.log(`✓ Migration applied: ${table}.${column} added`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      console.log(`✓ Column ${table}.${column} already exists — skipping`);
    } else {
      throw e;
    }
  }
}

async function main() {
  await addColumn("CampusQuestion", `ALTER TABLE "CampusQuestion" ADD COLUMN "reportData" JSONB`, "reportData");
  await addColumn("CampusQuestionAttempt", `ALTER TABLE "CampusQuestionAttempt" ADD COLUMN "blankAttempts" JSONB`, "blankAttempts");
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
