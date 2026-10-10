/**
 * Idempotent migration: add CampusSettings.leafletLocked (Mounjaro leaflet
 * content hidden by default; managers toggle it in Campus → Settings).
 * Mirrors prisma/migrations/20261007150000_campus_settings_leaflet_locked.
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-leaflet-lock.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("CampusSettings")`);
  if (rows.length === 0) {
    console.log("✓ CampusSettings table not created yet — Prisma will create it with the column");
  } else if (!rows.some(r => r.name === "leafletLocked")) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "CampusSettings" ADD COLUMN "leafletLocked" BOOLEAN NOT NULL DEFAULT true`);
    console.log("✓ Column CampusSettings.leafletLocked added (content hidden)");
  } else {
    console.log("✓ Column CampusSettings.leafletLocked already exists — skipping");
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
