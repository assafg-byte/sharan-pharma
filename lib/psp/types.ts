/**
 * Lilly PSP (Omvoh / Ebglyss support programs) — editable content model.
 *
 * The flow *structure* (which screens exist, where each answer leads, which
 * dates a screen can compute from) lives in code — see lib/psp/screens.ts.
 * Everything a manager may edit — texts, task lists, due-date offsets, SMS
 * templates and the Q&A — lives in a single PspContent JSON document that is
 * versioned in the PspContentVersion table.
 *
 * Inline text formatting: **bold** and line breaks. No raw HTML.
 * In ul/ol blocks, an item starting with "- " is a sub-item of the item above it.
 */

export type ProgramId = "omvoh" | "ebglyss";

/** When a task / SMS is due. `base` is one of the screen's date bases. */
export type Due =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "date"; base: string; weeks: number; days: number; fallback?: string };

export interface Task {
  id: string;
  title: string;
  sub: string;
  due: Due;
  /** Optional screen condition key (see ScreenDef.conds). Empty = always shown. */
  cond?: string;
}

export interface TaskGroup {
  id: string;
  title: string;
  /** Right-aligned column heading, e.g. "תאריכים לפתיחה במדיט". Empty = none. */
  right: string;
  tasks: Task[];
}

export interface SmsRef {
  id: string;
  key: string;
  when: Due;
  cond?: string;
}

export interface Answer {
  l: string;
  s: string;
}

export interface ScreenContent {
  texts: Record<string, string>;
  answers: Record<string, Answer>;
  groups: TaskGroup[];
  sms: SmsRef[];
}

export interface OmvohSettings {
  /** Below this many weeks since first IV → IV stage. */
  ivStageWeeks: number;
  /** Up to (and including) this many weeks → SC transition stage. Above → active. */
  moveStageWeeks: number;
  /** Weeks from infusion N to the SC-transition follow-up call. */
  infOffsets: Record<string, number>;
  /** Weeks from last known dose to the planned SC start (unknown first-IV path). */
  moveFromLastWeeks: number;
}

export interface ProgramContent {
  label: string;
  screens: Record<string, ScreenContent>;
}

export interface SmsTemplate {
  t: string;
  sub: string;
  body: string;
}

export type QaBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "note"; text: string }
  | { type: "alert"; text: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "copy"; title: string; text: string }
  | { type: "sms"; title: string; key: string };

export interface QaItem {
  id: string;
  q: string;
  blocks: QaBlock[];
  /** ISO time the question was added (or re-marked as new). While younger than
   *  settings.qaNewDays it shows a "חדש" badge. Absent = never shown as new. */
  addedAt?: string;
}

export interface QaTopic {
  id: string;
  t: string;
  prog: "both" | ProgramId;
  src: string;
  items: QaItem[];
}

export interface PspContent {
  schema: 1;
  /** Ids of one-time content patches already applied to this document (see CONTENT_PATCHES in defaultContent.ts). */
  patches?: string[];
  header: { title: string; sub: string };
  common: {
    newPatient: string;
    prevQuestion: string;
    smsHeading: string;
    unknownDate: string;
  };
  settings: {
    omvoh: OmvohSettings;
    /** Days a freshly added Q&A question keeps its "חדש" badge. 0 = badge disabled. */
    qaNewDays: number;
  };
  programs: Record<ProgramId, ProgramContent>;
  sms: Record<string, SmsTemplate>;
  qa: QaTopic[];
}

export interface PspVersionMeta {
  id: number;
  editor: string;
  note: string;
  createdAt: string;
}
