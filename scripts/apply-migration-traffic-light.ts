/**
 * Idempotent migration: add Notification.cleared (soft "clear history") and
 * create the TrafficLightConfig table with headcount thresholds (an earlier
 * version stored per-level colors — those columns are dropped). Mirrors
 * prisma/migrations/20261007090000_add_traffic_light_and_notification_cleared
 * and prisma/migrations/20261007120000_traffic_light_thresholds.
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-traffic-light.ts
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
  if (!(await columnExists("Notification", "cleared"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Notification" ADD COLUMN "cleared" BOOLEAN NOT NULL DEFAULT false`);
    console.log("✓ Column Notification.cleared added");
  } else {
    console.log("✓ Column Notification.cleared already exists — skipping");
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TrafficLightConfig" (
      "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
      "oneMin" INTEGER NOT NULL DEFAULT 1,
      "twoMin" INTEGER NOT NULL DEFAULT 2,
      "fullMin" INTEGER NOT NULL DEFAULT 3,
      "updatedAt" DATETIME NOT NULL
    )
  `);
  for (const [col, def] of [["oneMin", 1], ["twoMin", 2], ["fullMin", 3]] as const) {
    if (!(await columnExists("TrafficLightConfig", col))) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "TrafficLightConfig" ADD COLUMN "${col}" INTEGER NOT NULL DEFAULT ${def}`);
      console.log(`✓ Column TrafficLightConfig.${col} added`);
    }
  }
  for (const col of ["noneColor", "oneColor", "twoColor", "fullColor"]) {
    if (await columnExists("TrafficLightConfig", col)) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "TrafficLightConfig" DROP COLUMN "${col}"`);
      console.log(`✓ Column TrafficLightConfig.${col} dropped`);
    }
  }
  console.log("✓ TrafficLightConfig table ensured");
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
