/**
 * Nucala (GSK) interactive call script — editable content model.
 *
 * Unlike PSP, the whole script is data: a graph of nodes (screens), each with
 * content blocks and choice buttons that point at other nodes. Admins can edit
 * texts, add/delete nodes and re-wire choices. Versioned in NucalaContentVersion.
 *
 * Inline text formatting (see lib/psp/format.ts `rich`): **bold**, line breaks,
 * and links as [label](https://…).
 */

export type Tone = "teal" | "amber" | "purple" | "coral" | "pink" | "gray";
export type Who = "nurse" | "patient" | "family";

export type NBlock =
  | { type: "line"; who: Who; text: string }
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[]; start?: number }
  | { type: "note"; text: string }
  | { type: "warn"; text: string }
  | { type: "checklist"; title: string; items: string[] }
  | { type: "cols"; cols: { title: string; items: string[] }[] }
  | { type: "copy"; title: string; text: string }
  | { type: "form" };

export interface NChoice {
  id: string;
  label: string;
  to: string;
  primary?: boolean;
  /** Only shown when the node renders its choices as route cards. */
  desc?: string;
}

export interface NNode {
  id: string;
  /** Short label for the route trail. */
  track: string;
  section: string;
  title: string;
  /** Call-progress percentage shown in the progress bar. */
  pct: number;
  /** Phrase added to the copied call summary when this node was visited. */
  summary: string;
  blocks: NBlock[];
  choices: NChoice[];
  /** Render choices as large route cards (used on the home node). */
  cards?: boolean;
}

export interface NSection { id: string; name: string; tone: Tone }

export interface NField {
  id: string;
  label: string;
  hint: string;
  kind: "text" | "select";
  options: string[];
  placeholder: string;
  /** Label in the copied summary, e.g. "קופת חולים". */
  summaryLabel: string;
  /** Label in the bottom patient bar; empty = value shown alone. */
  barLabel: string;
  full?: boolean;
}

export interface NucalaContent {
  schema: 1;
  header: { title: string; sub: string; badge: string; footer: string; formHint: string; emptySummary: string };
  start: string;
  sections: NSection[];
  fields: NField[];
  nodes: NNode[];
}
