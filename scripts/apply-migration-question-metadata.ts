/**
 * Idempotent migration: add CampusQuestion.updatedDate and CampusQuestion.source.
 * Mirrors prisma/migrations/20260916115547_add_campus_question_metadata
 * (that migration rebuilds the table via SQLite's table-redefine pattern;
 * two additive ALTER TABLE ADD COLUMN statements reach the same end state
 * without needing to copy the whole table).
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-question-metadata.ts
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
  if (!(await columnExists("CampusQuestion", "updatedDate"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "CampusQuestion" ADD COLUMN "updatedDate" TEXT NOT NULL DEFAULT ''`);
    console.log("✓ Column CampusQuestion.updatedDate added");
  } else {
    console.log("✓ Column CampusQuestion.updatedDate already exists — skipping");
  }

  if (!(await columnExists("CampusQuestion", "source"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "CampusQuestion" ADD COLUMN "source" TEXT NOT NULL DEFAULT ''`);
    console.log("✓ Column CampusQuestion.source added");
  } else {
    console.log("✓ Column CampusQuestion.source already exists — skipping");
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
