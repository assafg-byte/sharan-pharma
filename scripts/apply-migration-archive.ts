/**
 * Idempotent migration: add Employee.archived for soft-delete (archive) support.
 * Runs as a Vercel build step — safe to re-run (no-ops if the column exists).
 * Local: npx tsx scripts/apply-migration-archive.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Employee" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false`
    );
    console.log("✓ Migration applied: Employee.archived added");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      console.log("✓ Column Employee.archived already exists — skipping");
    } else {
      throw e;
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
