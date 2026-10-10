/**
 * One-off reset: delete every task (all employees, all statuses) so the call
 * center can start the task board from scratch. Also removes what hangs off
 * tasks — first-view records (TaskView) and the task notifications in the
 * manager's bell (TASK_*). Campus learning history is NOT touched.
 *
 * Dry run by default — prints what would be deleted. Add --yes to delete.
 * Local:      npx tsx scripts/reset-tasks.ts [--yes]
 * Production: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN first (e.g. from
 *             `vercel env pull .env.vercel-prod --environment=production`).
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

const TASK_NOTIFICATION_TYPES = ["TASK_DUE_UNVIEWED", "TASK_VIEWED", "TASK_COMPLETED"];
const execute = process.argv.includes("--yes");

async function main() {
  console.log(`Database: ${process.env.TURSO_DATABASE_URL ? "Turso (TURSO_DATABASE_URL)" : "local dev.db"}`);

  const [tasks, views, notifications] = await Promise.all([
    prisma.task.findMany({ select: { id: true, title: true, status: true }, orderBy: { id: "asc" } }),
    prisma.taskView.count(),
    prisma.notification.count({ where: { type: { in: TASK_NOTIFICATION_TYPES } } }),
  ]);

  console.log(`Tasks: ${tasks.length}`);
  tasks.forEach(t => console.log(`  #${t.id} [${t.status}] ${t.title}`));
  console.log(`Task views: ${views}`);
  console.log(`Task notifications: ${notifications}`);

  if (!execute) {
    console.log("\nDry run — nothing deleted. Re-run with --yes to delete all of the above.");
    return;
  }

  const [v, n, t] = await prisma.$transaction([
    prisma.taskView.deleteMany({}),
    prisma.notification.deleteMany({ where: { type: { in: TASK_NOTIFICATION_TYPES } } }),
    prisma.task.deleteMany({}),
  ]);
  console.log(`\n✓ Deleted ${t.count} tasks, ${v.count} task views, ${n.count} task notifications`);
}

main().catch(e => { console.error(e); process.exit(1); })
      .finally(() => prisma.$disconnect());
