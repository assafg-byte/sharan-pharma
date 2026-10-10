/**
 * Build-time migration orchestrator — runs every idempotent migration/cleanup
 * script in order. Referenced from vercel.json (which has a 256-char
 * buildCommand limit, hence one entry point instead of a chain).
 * Add new migration scripts to the list below.
 */
import { execSync } from "child_process";

const STEPS = [
  "apply-migration-expected-end",
  "apply-migration-report-drag-drop",
  "apply-migration-checklist",
  "apply-migration-archive",
  "apply-migration-notifications",
  "apply-migration-break-slots",
  "apply-migration-question-metadata",
  "apply-migration-psp",
  "apply-migration-traffic-light",
  "apply-migration-leaflet-lock",
  "cleanup-duplicate-shifts",
];

for (const step of STEPS) {
  console.log(`── ${step} ──`);
  execSync(`npx tsx scripts/${step}.ts`, { stdio: "inherit" });
}
