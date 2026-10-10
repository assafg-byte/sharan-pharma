/**
 * One-time seeder — REPORT_DRAG_DROP exercises from docs/exercises_seed_data.json
 * Run: npx tsx scripts/seed-report-drag-drop.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";
import fs from "fs";
import { newId, validateReportExercise, type ReportExerciseData, type ReportSection } from "../components/reportExercise/types";

const url = process.env.TURSO_DATABASE_URL || `file:${path.resolve(process.cwd(), "dev.db")}`;
const adapter = new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const prisma = new PrismaClient({ adapter });

interface SourceExercise {
  id: string;
  title: string;
  scenario: string;
  sections: Array<
    | { type: "fields"; header: string; fields: { label: string; value: string }[] }
    | { type: "text"; header: string; content: string }
    | { type: "blank"; header: string; blankId: string }
  >;
  blanks: Array<{
    id: string;
    label: string;
    options: { text: string; correct: boolean; feedback?: string }[];
  }>;
}

function toReportData(ex: SourceExercise): ReportExerciseData {
  const sections: ReportSection[] = ex.sections.map(s => {
    if (s.type === "fields") {
      return { id: newId(), type: "fields", header: s.header, fields: s.fields };
    }
    if (s.type === "text") {
      return { id: newId(), type: "text", header: s.header, text: s.content };
    }
    const blank = ex.blanks.find(b => b.id === s.blankId);
    if (!blank) throw new Error(`${ex.id}: missing blank "${s.blankId}"`);
    return {
      id: newId(),
      type: "blank",
      header: s.header,
      options: blank.options.map(o => ({
        id: newId(),
        text: o.text,
        correct: o.correct,
        feedback: o.feedback || undefined,
      })),
    };
  });
  return { scenario: ex.scenario, sections };
}

async function main() {
  const file = path.resolve(process.cwd(), "docs/exercises_seed_data.json");
  const exercises: SourceExercise[] = JSON.parse(fs.readFileSync(file, "utf-8"));

  console.log(`Seeding ${exercises.length} REPORT_DRAG_DROP exercises...`);
  let created = 0;
  for (const ex of exercises) {
    const reportData = toReportData(ex);
    const errors = validateReportExercise(ex.title, reportData);
    if (errors.length > 0) {
      throw new Error(`${ex.id} (${ex.title}) failed validation:\n  ${errors.join("\n  ")}`);
    }
    await prisma.campusQuestion.create({
      data: {
        text: ex.title,
        type: "REPORT_DRAG_DROP",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswers: "",
        explanation: "",
        reportData: JSON.parse(JSON.stringify(reportData)),
      },
    });
    created++;
    console.log(`  ✓ ${ex.id} — ${ex.title}`);
  }
  console.log(`Done — ${created} exercises added.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
