// Shared shape for the "REPORT_DRAG_DROP" question type — stored as
// CampusQuestion.reportData (Json). Used by the trainee-facing card,
// the manager wizard, and the API routes.

export interface BlankOption {
  id: string;
  text: string;
  correct: boolean;
  feedback?: string; // required (validated) when correct === false
}

export type ReportSection =
  | { id: string; type: "fields"; header: string; fields: { label: string; value: string }[] }
  | { id: string; type: "text"; header: string; text: string }
  | { id: string; type: "blank"; header: string; options: BlankOption[] };

export interface ReportExerciseData {
  scenario: string;
  formTitle?: string; // defaults to "טופס דיווח"
  sections: ReportSection[];
}

export function blankSections(data: ReportExerciseData): Extract<ReportSection, { type: "blank" }>[] {
  return data.sections.filter((s): s is Extract<ReportSection, { type: "blank" }> => s.type === "blank");
}

export function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

export const EMPTY_REPORT_DATA: ReportExerciseData = { scenario: "", sections: [] };

// Validates a report exercise per the admin-wizard rules:
// scenario text, ≥1 blank, 2-5 options per blank, exactly 1 correct per blank,
// feedback required for every wrong option, every section/option has its text.
export function validateReportExercise(title: string, data: ReportExerciseData): string[] {
  const errors: string[] = [];
  if (!title.trim()) errors.push("יש להזין כותרת לתרגיל");
  if (!data.scenario.trim()) errors.push("יש להזין תיאור תרחיש");

  data.sections.forEach((s, i) => {
    if (!s.header.trim()) errors.push(`סעיף ${i + 1}: חסרה כותרת`);
    if (s.type === "fields" && s.fields.length === 0) errors.push(`סעיף ${i + 1}: יש להוסיף שדות`);
    if (s.type === "text" && !s.text.trim()) errors.push(`סעיף ${i + 1}: חסר טקסט`);
  });

  const blanks = blankSections(data);
  if (blanks.length === 0) errors.push("יש להוסיף לפחות שדה גרירה אחד");

  blanks.forEach((b, i) => {
    if (b.options.length < 2 || b.options.length > 5) {
      errors.push(`שדה גרירה ${i + 1}: יש להגדיר 2-5 אפשרויות`);
    }
    const correctCount = b.options.filter(o => o.correct).length;
    if (correctCount !== 1) {
      errors.push(`שדה גרירה ${i + 1}: יש לסמן אפשרות נכונה אחת בלבד`);
    }
    b.options.forEach((o, j) => {
      if (!o.text.trim()) errors.push(`שדה גרירה ${i + 1}, אפשרות ${j + 1}: חסר ניסוח`);
      if (!o.correct && !o.feedback?.trim()) {
        errors.push(`שדה גרירה ${i + 1}, אפשרות ${j + 1}: חובה לכתוב משוב לתשובה שגויה`);
      }
    });
  });

  return errors;
}
