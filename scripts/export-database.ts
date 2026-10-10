/**
 * Full database export → one portable .sql file (schema + all rows).
 * Used to hand the data over: the file can be loaded into any SQLite /
 * LibSQL / Turso database.
 *
 * READ-ONLY — only runs SELECTs, never changes the source database.
 *
 *   Production:     set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first, then
 *                   npx tsx scripts/export-database.ts [out.sql]
 *   Local dev.db:   npx tsx scripts/export-database.ts --local [out.sql]
 *
 * Without TURSO_DATABASE_URL the script refuses to run unless --local is given,
 * so a missing environment can never silently export the local test database.
 *
 * ⚠ The output contains personal data (names, phone digits, birth dates,
 *   password hashes, attendance). Move it over a secure channel only.
 *
 * Load it elsewhere:
 *   sqlite3 new.db < export.sql          (local file)
 *   turso db shell <db-name> < export.sql (Turso)
 */
import { createClient } from "@libsql/client";
import { writeFileSync } from "fs";
import path from "path";

const args = process.argv.slice(2);
const local = args.includes("--local");
const out = args.find(a => !a.startsWith("--")) || `database-export-${new Date().toISOString().slice(0, 10)}.sql`;

if (!process.env.TURSO_DATABASE_URL && !local) {
  console.error("TURSO_DATABASE_URL is not set — refusing to export, because that would silently export the LOCAL dev.db.\n" +
    "Load the production variables first (see header of this file), or pass --local to export dev.db on purpose.");
  process.exit(1);
}
const url = local ? `file:${path.resolve(process.cwd(), "dev.db")}` : process.env.TURSO_DATABASE_URL!;
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  if (v instanceof ArrayBuffer) return `X'${Buffer.from(v).toString("hex")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  console.log(`Source: ${local ? "LOCAL dev.db (--local)" : "Turso (TURSO_DATABASE_URL)"}`);

  // Prisma's own migration bookkeeping table (if present) is not data
  const master = await db.execute(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'
     ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`
  );
  const tables = master.rows.filter(r => r.type === "table");
  const lines: string[] = [
    `-- Exported ${new Date().toISOString()} — schema + data`,
    "PRAGMA foreign_keys=OFF;",
    "BEGIN TRANSACTION;",
  ];

  for (const t of tables) lines.push(`${t.sql};`);

  const counts: string[] = [];
  for (const t of tables) {
    const name = String(t.name);
    const rows = await db.execute(`SELECT * FROM "${name}"`);
    for (const row of rows.rows) {
      const cols = rows.columns.map(c => `"${c}"`).join(", ");
      lines.push(`INSERT INTO "${name}" (${cols}) VALUES (${rows.columns.map((_, i) => lit(row[i])).join(", ")});`);
    }
    counts.push(`${name}: ${rows.rows.length}`);
  }

  for (const i of master.rows.filter(r => r.type !== "table")) lines.push(`${i.sql};`);
  lines.push("COMMIT;", "PRAGMA foreign_keys=ON;");

  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`✓ Wrote ${out}\n  ${counts.join("\n  ")}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.close());
