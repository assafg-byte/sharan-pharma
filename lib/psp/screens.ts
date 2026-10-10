/**
 * Flow structure for the PSP programs — the part that is NOT editable.
 *
 * Each ScreenDef declares which editable text fields a screen has, which
 * answers it offers and where they lead, and which named dates ("bases")
 * a task due-date on that screen may be computed from. `screenContext`
 * turns the live flow state into concrete values for those bases,
 * conditions and {placeholders}.
 */
import type { OmvohSettings, ProgramId } from "./types";
import { addWeeks, fmt, weeksBetween } from "./format";

export interface FieldDef { key: string; label: string; multiline?: boolean }
export interface AnswerDef { key: string; label: string; to: string }

export interface ScreenDef {
  id: string;
  name: string;
  kind: "question" | "tasks" | "form" | "stage";
  fields: FieldDef[];
  answers?: AnswerDef[];
  bases?: Record<string, string>;
  conds?: Record<string, string>;
  vars?: Record<string, string>;
}

const STEP: FieldDef = { key: "step", label: "כותרת עליונה (שלב)" };
const TITLE: FieldDef = { key: "title", label: "כותרת" };
const SUB: FieldDef = { key: "sub", label: "תת-כותרת", multiline: true };
const TASK_FIELDS = [STEP, TITLE, SUB];
/** Light-blue disclaimer box shown under the task list(s), above the SMS texts. */
const NOTE: FieldDef = { key: "note", label: "תיבת הערה (תכלת)", multiline: true };

export const FLOW: Record<ProgramId, ScreenDef[]> = {
  omvoh: [
    { id: "start", name: "שלב מקדים — קיים בתוכנית?", kind: "question", fields: [STEP, TITLE, SUB],
      answers: [{ key: "new", label: "מטופל חדש", to: "NEW" }, { key: "old", label: "מטופל ותיק", to: "V_DATES" }] },
    { id: "V_DATES", name: "ותיק · הזנת תאריכים", kind: "form",
      fields: [STEP, TITLE, { key: "labelSc", label: "תווית תאריך SC" }, { key: "labelTr", label: "תווית תאריך הדרכה" }, { key: "button", label: "טקסט הכפתור" }] },
    { id: "V_TASKS", name: "ותיק · משימות", kind: "tasks", fields: TASK_FIELDS,
      bases: { tr: "תאריך הדרכה", sc: "תאריך הזרקת SC" } },
    { id: "NEW", name: "חדש · תאריך עירוי ראשון", kind: "form",
      fields: [STEP, TITLE, SUB, { key: "hint", label: "הערה מתחת לשדה" }, { key: "unknown", label: "תיבת סימון — לא ידוע" }, { key: "button", label: "טקסט הכפתור" }] },
    { id: "UNK", name: "חדש · תאריך עירוי לא ידוע", kind: "form",
      fields: [STEP, TITLE, SUB, { key: "labelDate", label: "תווית תאריך" }, { key: "typeQ", label: "שאלת אופן מתן" }, { key: "infQ", label: "שאלת מספר עירוי" }, { key: "button", label: "טקסט הכפתור" }] },
    { id: "stage", name: "תוצאת חישוב השלב", kind: "stage",
      fields: [STEP, TITLE,
        { key: "ivStage", label: "שלב IV — שם" }, { key: "ivSub", label: "שלב IV — הסבר" },
        { key: "moveStage", label: "שלב מעבר — שם" }, { key: "moveSub", label: "שלב מעבר — הסבר" },
        { key: "activeStage", label: "מטופל פעיל — שם" }, { key: "activeSub", label: "מטופל פעיל — הסבר" },
        { key: "calcTitle", label: "כותרת החישוב" }, { key: "rowIv", label: "שורה — עירוי ראשון" },
        { key: "rowToday", label: "שורה — היום" }, { key: "rowWeeks", label: "שורה — שבועות" }],
      answers: [{ key: "next", label: "כפתור המשך", to: "(לפי השלב)" }],
      vars: { ivWeeks: "סף שלב IV (שבועות)", moveWeeks: "סף שלב מעבר (שבועות)", weeks: "שבועות שחלפו" } },
    { id: "A1", name: "ענף IV · משימות", kind: "tasks", fields: TASK_FIELDS, bases: { iv: "עירוי ראשון" } },
    { id: "A1U", name: "ענף IV (עירוי ידוע) · משימות", kind: "tasks", fields: TASK_FIELDS,
      bases: { last: "עירוי אחרון", target: "מועד שיחת מעבר (עירוי אחרון + היסט לפי מספר העירוי)" },
      vars: { infNo: "מספר העירוי", lastDate: "תאריך העירוי האחרון", offset: "היסט השבועות" } },
    { id: "B1", name: "ענף מעבר · עובר ל-SC?", kind: "question", fields: [STEP, TITLE, SUB],
      answers: [{ key: "yes", label: "כן", to: "TRAIN" }, { key: "no", label: "לא", to: "B_NO" }] },
    { id: "B_NO", name: "ענף מעבר · לא עובר", kind: "tasks",
      fields: [...TASK_FIELDS, { key: "modalTitle", label: "חלון קופץ — כותרת" }, { key: "modal", label: "חלון קופץ — טקסט", multiline: true }],
      bases: { iv: "עירוי ראשון" } },
    { id: "TRAIN", name: "תיאום הדרכה", kind: "tasks", fields: TASK_FIELDS,
      bases: { move: "מועד מעבר ל-SC (מחושב)" },
      conds: { newPatient: "רק מטופל חדש (ללא תאריך עירוי ראשון)", notSC: "רק אם לא כבר ב-SC" },
      vars: { moveSrc: "מקור החישוב (למשל: עירוי 3 + 4 שבועות)" } },
    { id: "C1", name: "מטופל פעיל · התקיימה הדרכה?", kind: "question",
      fields: [STEP, TITLE, { key: "subIv", label: "תת-כותרת (עירוי ראשון ידוע)", multiline: true }, { key: "subSc", label: "תת-כותרת (מטופל ב-SC)", multiline: true }],
      answers: [{ key: "yes", label: "כן", to: "C_DATES" }, { key: "no", label: "לא", to: "TRAIN" }],
      vars: { weeks: "שבועות מהעירוי הראשון", moveWeeks: "סף שלב מעבר (שבועות)" } },
    { id: "C_DATES", name: "מטופל פעיל · הזנת תאריכים", kind: "form",
      fields: [STEP, TITLE, SUB, { key: "labelSc", label: "תווית תאריך SC" }, { key: "labelTr", label: "תווית תאריך הדרכה" }, { key: "button", label: "טקסט הכפתור" }] },
    { id: "C_EQ", name: "SC = הדרכה · משימות", kind: "tasks", fields: TASK_FIELDS, bases: { sc: "תאריך SC", tr: "תאריך הדרכה" } },
    { id: "C_NEQ", name: "SC ≠ הדרכה · משימות", kind: "tasks", fields: TASK_FIELDS, bases: { tr: "תאריך הדרכה", sc: "תאריך SC" } },
  ],
  ebglyss: [
    { id: "start", name: "שלב מקדים — קיים בתוכנית?", kind: "question", fields: [STEP, TITLE, SUB],
      answers: [{ key: "new", label: "מטופל חדש", to: "E_NEW" }, { key: "old", label: "מטופל ותיק", to: "V_DATES" }] },
    { id: "E_NEW", name: "חדש · קליטה", kind: "tasks", fields: TASK_FIELDS,
      answers: [{ key: "next", label: "ההדרכה בוצעה", to: "V_DATES" }] },
    { id: "V_DATES", name: "הזנת תאריכים", kind: "form",
      fields: [STEP, TITLE, { key: "labelSc", label: "תווית תאריך SC" }, { key: "labelTr", label: "תווית תאריך הדרכה" }, { key: "button", label: "טקסט הכפתור" }] },
    { id: "V_TASKS", name: "משימות המשך", kind: "tasks",
      fields: [...TASK_FIELDS, NOTE, { key: "flabel", label: "כותרת מעל הכפתורים" }],
      bases: { tr: "תאריך הדרכה", sc: "תאריך הזרקת SC" },
      answers: [{ key: "w16", label: "שיחת מעקב שבוע 16", to: "E_W16" }, { key: "w24", label: "שיחת מעקב שבוע 24", to: "E_W24" }] },
    { id: "E_W16", name: "שבוע 16 · הנחיה רפואית", kind: "question", fields: [STEP, TITLE, SUB],
      answers: [{ key: "cont", label: "ממשיך כל שבועיים", to: "E16_CONT" }, { key: "w4", label: "עובר לכל 4 שבועות", to: "E_4W" }, { key: "nodir", label: "אין הנחיה", to: "E_NODIR" }] },
    { id: "E16_CONT", name: "שבוע 16 · ממשיך", kind: "tasks", fields: TASK_FIELDS, bases: { tr: "תאריך הדרכה" },
      answers: [{ key: "next", label: "ביצוע שיחת שבוע 24", to: "E_W24" }] },
    { id: "E_W24", name: "שבוע 24 · הנחיה רפואית", kind: "question", fields: [STEP, TITLE, SUB],
      answers: [{ key: "cont", label: "ממשיך כל שבועיים", to: "E24_STOP" }, { key: "w4", label: "עובר לכל 4 שבועות", to: "E_4W" }, { key: "nodir", label: "אין הנחיה", to: "E_NODIR24" }] },
    { id: "E24_STOP", name: "שבוע 24 · ממשיך (סגירת תזכורות)", kind: "tasks",
      fields: [...TASK_FIELDS, { key: "keep", label: "תיבת הדגשה", multiline: true }] },
    { id: "E_4W", name: "עובר לאחת ל-4 שבועות", kind: "tasks", fields: TASK_FIELDS },
    { id: "E_NODIR", name: "שבוע 16 · אין הנחיה מהרופא", kind: "tasks", fields: [...TASK_FIELDS, NOTE] },
    { id: "E_NODIR24", name: "שבוע 24 · אין הנחיה מהרופא", kind: "tasks", fields: [...TASK_FIELDS, NOTE] },
  ],
};

export const screenDef = (p: ProgramId, id: string) => FLOW[p].find(s => s.id === id);

export interface FlowState {
  iv: Date | null;
  scDate: Date | null;
  trDate: Date | null;
  lastDate: Date | null;
  lastType: "SC" | "IV" | null;
  infNo: number | null;
}

export const EMPTY_STATE: FlowState = { iv: null, scDate: null, trDate: null, lastDate: null, lastType: null, infNo: null };

export interface ScreenCtx {
  bases: Record<string, Date | null>;
  conds: Record<string, boolean>;
  vars: Record<string, string>;
}

export function screenContext(p: ProgramId, id: string, s: FlowState, set: OmvohSettings, today: Date): ScreenCtx {
  const ctx: ScreenCtx = { bases: {}, conds: {}, vars: {} };
  if (s.iv) ctx.bases.iv = s.iv;
  if (s.trDate) ctx.bases.tr = s.trDate;
  if (s.scDate) ctx.bases.sc = s.scDate;
  if (s.lastDate) ctx.bases.last = s.lastDate;
  if (p !== "omvoh") return ctx;

  if (id === "A1U" && s.lastDate && s.infNo) {
    const off = set.infOffsets[String(s.infNo)] ?? 0;
    ctx.bases.target = addWeeks(s.lastDate, off);
    ctx.vars = { infNo: String(s.infNo), lastDate: fmt(s.lastDate), offset: String(off) };
  }
  if (id === "TRAIN") {
    const move = s.iv ? addWeeks(s.iv, set.moveStageWeeks)
      : s.lastDate ? addWeeks(s.lastDate, set.moveFromLastWeeks) : null;
    ctx.bases.move = move;
    const newPt = !s.iv;
    const onSC = newPt && s.lastType === "SC";
    ctx.conds = { newPatient: newPt, notSC: !onSC };
    ctx.vars.moveSrc = s.iv ? ""
      : onSC ? `תאריך SC אחרון + ${set.moveFromLastWeeks} שבועות`
      : `עירוי ${s.infNo ?? "?"} + ${set.moveFromLastWeeks} שבועות`;
  }
  if (id === "stage" || id === "C1") {
    ctx.vars.ivWeeks = String(set.ivStageWeeks);
    ctx.vars.moveWeeks = String(set.moveStageWeeks);
    if (s.iv) ctx.vars.weeks = String(weeksBetween(s.iv, today));
  }
  return ctx;
}

/** Sample state used when a manager jumps straight to a screen in edit mode. */
export function sampleState(p: ProgramId, id: string, today: Date): FlowState {
  const s: FlowState = { ...EMPTY_STATE };
  const back = (w: number) => addWeeks(today, -w);
  if (p === "omvoh") {
    if (["stage", "A1", "B1", "B_NO"].includes(id)) s.iv = back(10);
    if (id === "C1") s.iv = back(14);
    if (["A1U", "TRAIN"].includes(id)) { s.lastDate = back(2); s.lastType = "IV"; s.infNo = id === "TRAIN" ? 3 : 2; }
  }
  if (["V_TASKS", "C_EQ", "C_NEQ", "E16_CONT"].includes(id)) {
    s.trDate = back(1);
    s.scDate = id === "C_EQ" ? back(1) : back(2);
  }
  return s;
}

