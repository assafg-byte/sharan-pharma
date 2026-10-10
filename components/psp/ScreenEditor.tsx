"use client";

import { useState } from "react";
import type { Due, ProgramId, PspContent, SmsRef, Task, TaskGroup } from "@/lib/psp/types";
import { screenDef, type ScreenDef } from "@/lib/psp/screens";
import { describeDue, newId, plain } from "@/lib/psp/format";
import { Icon } from "./icons";
import type { Updater } from "./PspApp";

export function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

export function RowTools({ i, n, onMove, onDelete, label }: {
  i: number; n: number; onMove: (dir: -1 | 1) => void; onDelete: () => void; label: string;
}) {
  return <>
    <button type="button" className="ib" title="למעלה" aria-label={`הזזת ${label} למעלה`} disabled={i === 0} onClick={e => { e.stopPropagation(); onMove(-1); }}><Icon.up /></button>
    <button type="button" className="ib" title="למטה" aria-label={`הזזת ${label} למטה`} disabled={i === n - 1} onClick={e => { e.stopPropagation(); onMove(1); }}><Icon.down /></button>
    <button type="button" className="ib del" title="מחיקה" aria-label={`מחיקת ${label}`} onClick={e => { e.stopPropagation(); onDelete(); }}><Icon.trash /></button>
  </>;
}

export const FormatHint = () => (
  <p className="hint">עיצוב: <code>**טקסט**</code> = <b>מודגש</b> · ירידת שורה נשמרת.</p>
);

export default function ScreenEditor({ prog, id, content, update, onJump, screens }: {
  prog: ProgramId; id: string; content: PspContent; update: Updater; onJump: (id: string) => void; screens: ScreenDef[];
}) {
  const def = screenDef(prog, id)!;
  const sc = content.programs[prog].screens[id];
  const edit = (fn: (s: typeof sc) => void) => update(d => fn(d.programs[prog].screens[id]));
  const isTasks = def.kind === "tasks";

  return (
    <aside className="ed" aria-label="עריכת המסך">
      <div className="ed-hd">
        <label htmlFor="ed-screen">מסך לעריכה</label>
        <select id="ed-screen" className="inp" value={id} onChange={e => onJump(e.target.value)}>
          {screens.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <section className="ed-sec">
        <h3>טקסטים</h3>
        <FormatHint />
        {def.vars && (
          <div className="vars">
            {Object.entries(def.vars).map(([k, l]) => <span key={k}><code>{`{${k}}`}</code> {l}</span>)}
          </div>
        )}
        {def.fields.map(f => (
          <label key={f.key} className="fld">
            <span>{f.label}</span>
            {f.multiline
              ? <textarea className="inp" rows={3} value={sc.texts[f.key] ?? ""} onChange={e => edit(s => { s.texts[f.key] = e.target.value; })} />
              : <input className="inp" value={sc.texts[f.key] ?? ""} onChange={e => edit(s => { s.texts[f.key] = e.target.value; })} />}
          </label>
        ))}
      </section>

      {def.answers && def.answers.length > 0 && (
        <section className="ed-sec">
          <h3>כפתורי תשובה <span>היעד של כל כפתור קבוע</span></h3>
          {def.answers.map(a => {
            const ans = sc.answers[a.key] ?? { l: "", s: "" };
            const to = screenDef(prog, a.to)?.name ?? a.to;
            return (
              <div key={a.key} className="ans-ed">
                <div className="to">מוביל אל <b>{to}</b></div>
                <input className="inp" placeholder="טקסט הכפתור" value={ans.l}
                  onChange={e => edit(s => { s.answers[a.key] = { ...ans, l: e.target.value }; })} />
                <input className="inp sm" style={{ marginTop: 6 }} placeholder="שורת הסבר (לא חובה)" value={ans.s}
                  onChange={e => edit(s => { s.answers[a.key] = { ...ans, s: e.target.value }; })} />
              </div>
            );
          })}
        </section>
      )}

      {isTasks && (
        <section className="ed-sec">
          <h3>משימות <span>לחיצה על משימה פותחת אותה לעריכה</span></h3>
          {sc.groups.map((g, gi) => (
            <GroupEditor key={g.id} g={g} gi={gi} n={sc.groups.length} def={def}
              edit={fn => edit(s => fn(s.groups[gi]))}
              onMove={dir => edit(s => move(s.groups, gi, dir))}
              onDelete={() => { if (confirm(`למחוק את הקבוצה "${g.title}" וכל המשימות שבה?`)) edit(s => { s.groups.splice(gi, 1); }); }} />
          ))}
          <button type="button" className="add" onClick={() => edit(s => {
            s.groups.push({ id: newId(), title: "משימות למוקד", right: "", tasks: [] });
          })}><Icon.plus />קבוצת משימות חדשה</button>
        </section>
      )}

      {isTasks && (
        <section className="ed-sec">
          <h3>נוסחי SMS במסך</h3>
          {sc.sms.map((m, mi) => (
            <SmsRefEditor key={m.id} m={m} i={mi} n={sc.sms.length} def={def} content={content}
              edit={fn => edit(s => fn(s.sms[mi]))}
              onMove={dir => edit(s => move(s.sms, mi, dir))}
              onDelete={() => edit(s => { s.sms.splice(mi, 1); })} />
          ))}
          <button type="button" className="add" onClick={() => edit(s => {
            s.sms.push({ id: newId(), key: Object.keys(content.sms)[0] ?? "", when: { kind: "none" } });
          })}><Icon.plus />הוספת נוסח SMS למסך</button>
          <p className="hint" style={{ marginTop: 8 }}>את הנוסחים עצמם עורכים בלשונית &quot;נוסחי SMS&quot;.</p>
        </section>
      )}
    </aside>
  );
}

function GroupEditor({ g, gi, n, def, edit, onMove, onDelete }: {
  g: TaskGroup; gi: number; n: number; def: ScreenDef;
  edit: (fn: (g: TaskGroup) => void) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="grp-ed">
      <div className="grp-ed-hd">
        <input className="inp sm" aria-label="כותרת הקבוצה" value={g.title} onChange={e => edit(x => { x.title = e.target.value; })} />
        <RowTools i={gi} n={n} onMove={onMove} onDelete={onDelete} label="קבוצה" />
      </div>
      <div style={{ padding: "8px 10px 0" }}>
        <label className="fld"><span>כותרת עמודת התאריכים (לא חובה)</span>
          <input className="inp sm" value={g.right} placeholder="למשל: תאריכים לפתיחה במדיט" onChange={e => edit(x => { x.right = e.target.value; })} />
        </label>
      </div>
      {g.tasks.map((t, ti) => (
        <div key={t.id} className="t-ed">
          <div className="t-row" onClick={() => setOpen(open === t.id ? null : t.id)}>
            <span className="tt">
              <b>{plain(t.title) || "משימה ללא כותרת"}</b>
              <small>{describeDue(t.due, def.bases)}</small>
            </span>
            {t.cond && <span className="cond">מותנה</span>}
            <RowTools i={ti} n={g.tasks.length} label="משימה"
              onMove={dir => edit(x => move(x.tasks, ti, dir))}
              onDelete={() => { if (confirm(`למחוק את המשימה "${plain(t.title)}"?`)) edit(x => { x.tasks.splice(ti, 1); }); }} />
          </div>
          {open === t.id && <TaskBody t={t} def={def} edit={fn => edit(x => fn(x.tasks[ti]))} />}
        </div>
      ))}
      <div className="t-ed">
        <button type="button" className="add" onClick={() => {
          const nt: Task = { id: newId(), title: "משימה חדשה", sub: "", due: { kind: "text", text: "מיידי" } };
          edit(x => { x.tasks.push(nt); });
          setOpen(nt.id);
        }}><Icon.plus />משימה חדשה</button>
      </div>
    </div>
  );
}

function TaskBody({ t, def, edit }: { t: Task; def: ScreenDef; edit: (fn: (t: Task) => void) => void }) {
  return (
    <div className="t-body">
      <label className="fld"><span>כותרת המשימה</span>
        <input className="inp" autoFocus value={t.title} onChange={e => edit(x => { x.title = e.target.value; })} />
      </label>
      <label className="fld"><span>הסבר (לא חובה)</span>
        <textarea className="inp" rows={2} value={t.sub} onChange={e => edit(x => { x.sub = e.target.value; })} />
      </label>
      <div className="fld"><span>מועד</span>
        <DueEditor due={t.due} bases={def.bases} onChange={d => edit(x => { x.due = d; })} />
      </div>
      {def.conds && <CondSelect value={t.cond} conds={def.conds} onChange={c => edit(x => { x.cond = c; })} />}
    </div>
  );
}

function CondSelect({ value, conds, onChange }: {
  value?: string; conds: Record<string, string>; onChange: (c: string | undefined) => void;
}) {
  return (
    <label className="fld"><span>מתי להציג</span>
      <select className="inp sm" value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}>
        <option value="">תמיד</option>
        {Object.entries(conds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

export function DueEditor({ due, bases, onChange, allowNone }: {
  due: Due; bases?: Record<string, string>; onChange: (d: Due) => void; allowNone?: boolean;
}) {
  const hasBases = bases && Object.keys(bases).length > 0;
  const setKind = (k: Due["kind"]) => {
    if (k === "none") onChange({ kind: "none" });
    else if (k === "text") onChange({ kind: "text", text: due.kind === "text" ? due.text : "מיידי" });
    else onChange({ kind: "date", base: Object.keys(bases!)[0], weeks: 0, days: 0 });
  };
  const num = (v: string) => Math.max(-999, Math.min(999, parseInt(v, 10) || 0));
  return (
    <div>
      <select className="inp sm" value={due.kind} onChange={e => setKind(e.target.value as Due["kind"])} style={{ marginBottom: 6 }}>
        {allowNone && <option value="none">בלי מועד</option>}
        <option value="text">טקסט חופשי</option>
        {hasBases && <option value="date">תאריך מחושב</option>}
      </select>
      {due.kind === "text" && (
        <input className="inp sm" value={due.text} placeholder="למשל: מיידי" onChange={e => onChange({ ...due, text: e.target.value })} />
      )}
      {due.kind === "date" && hasBases && <>
        <div className="due">
          <select className="inp sm" style={{ flex: "1 1 160px", width: "auto" }} value={due.base} onChange={e => onChange({ ...due, base: e.target.value })}>
            {Object.entries(bases!).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="lbl">+</span>
          <input className="inp sm num" type="number" value={due.weeks} onChange={e => onChange({ ...due, weeks: num(e.target.value) })} aria-label="שבועות" />
          <span className="lbl">שבועות</span>
          <span className="lbl">+</span>
          <input className="inp sm num" type="number" value={due.days} onChange={e => onChange({ ...due, days: num(e.target.value) })} aria-label="ימים" />
          <span className="lbl">ימים</span>
        </div>
        <input className="inp sm" style={{ marginTop: 6 }} value={due.fallback ?? ""} placeholder="טקסט כשהתאריך לא ידוע (לא חובה)"
          onChange={e => onChange({ ...due, fallback: e.target.value || undefined })} />
      </>}
    </div>
  );
}

function SmsRefEditor({ m, i, n, def, content, edit, onMove, onDelete }: {
  m: SmsRef; i: number; n: number; def: ScreenDef; content: PspContent;
  edit: (fn: (m: SmsRef) => void) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
}) {
  return (
    <div className="ans-ed">
      <div className="due" style={{ marginBottom: 6 }}>
        <select className="inp sm" style={{ flex: 1, width: "auto" }} value={m.key} onChange={e => edit(x => { x.key = e.target.value; })}>
          {!content.sms[m.key] && <option value={m.key}>(נוסח שנמחק)</option>}
          {Object.entries(content.sms).map(([k, t]) => <option key={k} value={k}>{t.t}</option>)}
        </select>
        <RowTools i={i} n={n} onMove={onMove} onDelete={onDelete} label="נוסח" />
      </div>
      <div className="fld" style={{ marginBottom: 0 }}><span>מתי לשלוח (תגית על הכרטיס)</span>
        <DueEditor due={m.when} bases={def.bases} allowNone onChange={d => edit(x => { x.when = d; })} />
      </div>
      {def.conds && <div style={{ marginTop: 8 }}><CondSelect value={m.cond} conds={def.conds} onChange={c => edit(x => { x.cond = c; })} /></div>}
    </div>
  );
}
