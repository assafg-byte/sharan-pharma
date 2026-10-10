/**
 * Idempotent migration: add expectedEnd column to AttendanceBreak.
 * Runs as a Vercel build step — safe to re-run (no-ops if column exists).
 * Local: npx tsx scripts/apply-migration-expected-end.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$executeRaw`ALTER TABLE "AttendanceBreak" ADD COLUMN "expectedEnd" DATETIME`;
    console.log("✓ Migration applied: AttendanceBreak.expectedEnd added");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      console.log("✓ Column expectedEnd already exists — skipping");
    } else {
      throw e;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
