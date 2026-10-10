/**
 * Idempotent migration: create the ChecklistItem table for the manager-editable
 * daily check-in checklist, and seed the three original hardcoded questions
 * if the table is empty (preserves existing behavior on first deploy).
 * Runs as a Vercel build step — safe to re-run.
 * Local: npx tsx scripts/apply-migration-checklist.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ITEMS = [
  {
    order: 0,
    text: "שלום {name}! האם {אתה נכנס|את נכנסת} למשמרת?",
    delaySec: 0,
    pendingLabel: "",
    confirmedLabel: "",
    confirmedOptions: "",
  },
  {
    order: 1,
    text: "האם ה-Avaya פועל וניתן לקבל שיחות?",
    delaySec: 10,
    pendingLabel: "רגע, אני {בודק|בודקת}",
    confirmedLabel: "כן, התוכנה פועלת ✓",
    confirmedOptions: "",
  },
  {
    order: 2,
    text: "האם יש מטופלים שצריך לחזור אליהם מטבלת ההשלמות/משיבון?",
    delaySec: 10,
    pendingLabel: "רגע, אני {בודק|בודקת}",
    confirmedLabel: "",
    confirmedOptions: "בדקתי ואין לי שיחות לחזור אליהן\nבדקתי, אחזור לשיחות במהלך היום",
  },
];

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ChecklistItem" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "order" INTEGER NOT NULL DEFAULT 0,
      "text" TEXT NOT NULL,
      "delaySec" INTEGER NOT NULL DEFAULT 0,
      "pendingLabel" TEXT NOT NULL DEFAULT '',
      "confirmedLabel" TEXT NOT NULL DEFAULT '',
      "confirmedOptions" TEXT NOT NULL DEFAULT ''
    )
  `);
  console.log("✓ ChecklistItem table ensured");

  const count = await prisma.checklistItem.count();
  if (count === 0) {
    await prisma.checklistItem.createMany({ data: DEFAULT_ITEMS });
    console.log(`✓ Seeded ${DEFAULT_ITEMS.length} default checklist questions`);
  } else {
    console.log(`✓ ChecklistItem already has ${count} rows — skipping seed`);
  }
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
