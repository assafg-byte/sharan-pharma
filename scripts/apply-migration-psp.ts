/**
 * Idempotent migration: create the PspContentVersion and NucalaContentVersion tables.
 * Mirrors prisma/migrations/20260923120000_add_psp_content_version and
 * 20260924090000_add_nucala_content_version.
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-psp.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const table of ["PspContentVersion", "NucalaContentVersion"]) {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "${table}" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "data" TEXT NOT NULL,
      "editor" TEXT NOT NULL DEFAULT '',
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log(`✓ Table ${table} ready`);
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
