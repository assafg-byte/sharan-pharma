"use client";

import type { NField, NucalaContent, Tone } from "@/lib/nucala/types";
import { newId } from "@/lib/psp/format";
import { Icon } from "@/components/psp/icons";
import { RowTools, move } from "@/components/psp/ScreenEditor";
import { TONE, type NUpdater } from "./NucalaApp";

const TONES: [Tone, string][] = [["teal", "ירוק"], ["amber", "כתום"], ["purple", "סגול"], ["coral", "אדום"], ["pink", "ורוד"], ["gray", "אפור"]];

export default function SettingsView({ content, update }: { content: NucalaContent; update: NUpdater }) {
  const h = content.header;
  const headerFields: [keyof NucalaContent["header"], string][] = [
    ["title", "כותרת"], ["sub", "שורת משנה"], ["badge", "תגית גרסה"], ["footer", "שורת תחתית"],
    ["formHint", "הערה מתחת לטופס פרטי המטופל"], ["emptySummary", "סיכום כשאין פעולות"],
  ];
  const editField = (i: number, fn: (f: NField) => void) => update(d => fn(d.fields[i]));

  return (
    <div className="pg" style={{ maxWidth: "none" }}>
      <div className="pg-hd"><h1>הגדרות התסריט</h1><p>טקסטים כלליים, חלקי התסריט ושדות טופס פרטי המטופל.</p></div>

      <div className="card-ed">
        <h2>טקסטים כלליים</h2>
        <div className="grid2">
          {headerFields.map(([k, l]) => (
            <label key={k} className="fld"><span>{l}</span>
              <input className="inp" value={h[k]} onChange={e => update(d => { d.header[k] = e.target.value; })} /></label>
          ))}
          <label className="fld"><span>מסך הפתיחה של התסריט</span>
            <select className="inp" value={content.start} onChange={e => update(d => { d.start = e.target.value; })}>
              {content.nodes.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select></label>
        </div>
      </div>

      <div className="card-ed">
        <h2>חלקי התסריט <span className="k">התגית הצבעונית בראש כל מסך</span></h2>
        {content.sections.map((s, i) => {
          const used = content.nodes.filter(x => x.section === s.id).length;
          return (
            <div key={s.id} className="ed-row" style={{ marginBottom: 8 }}>
              <span className="tone-dot" style={{ background: TONE[s.tone].fg }} />
              <input className="inp sm" value={s.name} aria-label="שם החלק" onChange={e => update(d => { d.sections[i].name = e.target.value; })} />
              <select className="inp sm" style={{ width: "auto", flex: "none" }} value={s.tone} aria-label="צבע"
                onChange={e => update(d => { d.sections[i].tone = e.target.value as Tone; })}>
                {TONES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
              </select>
              <span className="hint" style={{ margin: 0, flex: "none", width: 60 }}>{used} מסכים</span>
              <button type="button" className="ib del" title="מחיקה" aria-label="מחיקת החלק" disabled={used > 0}
                onClick={() => update(d => { d.sections.splice(i, 1); })}><Icon.trash /></button>
            </div>
          );
        })}
        <p className="hint">אפשר למחוק רק חלק שאין בו מסכים.</p>
        <button type="button" className="add" onClick={() => update(d => { d.sections.push({ id: "s_" + newId(), name: "חלק חדש", tone: "teal" }); })}>
          <Icon.plus />חלק חדש</button>
      </div>

      <div className="card-ed">
        <h2>טופס פרטי מטופל</h2>
        {content.fields.map((f, i) => (
          <div key={f.id} className="ans-ed">
            <div className="ed-row" style={{ marginBottom: 8 }}>
              <input className="inp" value={f.label} aria-label="שם השדה" onChange={e => editField(i, x => { x.label = e.target.value; })} />
              <RowTools i={i} n={content.fields.length} label="שדה"
                onMove={dir => update(d => move(d.fields, i, dir))}
                onDelete={() => { if (confirm(`למחוק את השדה "${f.label}"?`)) update(d => { d.fields.splice(i, 1); }); }} />
            </div>
            <div className="grid2">
              <label className="fld"><span>סוג</span>
                <select className="inp sm" value={f.kind} onChange={e => editField(i, x => { x.kind = e.target.value as NField["kind"]; })}>
                  <option value="text">טקסט חופשי</option><option value="select">בחירה מרשימה</option>
                </select></label>
              <label className="fld"><span>{f.kind === "select" ? "טקסט לפני בחירה" : "טקסט דוגמה"}</span>
                <input className="inp sm" value={f.placeholder} onChange={e => editField(i, x => { x.placeholder = e.target.value; })} /></label>
              <label className="fld"><span>הערה ליד השם</span>
                <input className="inp sm" value={f.hint} onChange={e => editField(i, x => { x.hint = e.target.value; })} /></label>
              <label className="fld"><span>שם בסיכום השיחה</span>
                <input className="inp sm" value={f.summaryLabel} onChange={e => editField(i, x => { x.summaryLabel = e.target.value; })} /></label>
              <label className="fld"><span>שם בשורת פרטי המטופל (ריק = רק הערך)</span>
                <input className="inp sm" value={f.barLabel} onChange={e => editField(i, x => { x.barLabel = e.target.value; })} /></label>
              <label className="fld" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 22 }}>
                <input type="checkbox" checked={!!f.full} onChange={e => editField(i, x => { x.full = e.target.checked || undefined; })} />
                <span style={{ margin: 0 }}>שדה ברוחב מלא</span></label>
            </div>
            {f.kind === "select" && (
              <label className="fld" style={{ marginBottom: 0 }}><span>אפשרויות (שורה לכל אפשרות)</span>
                <textarea className="inp" rows={Math.max(3, f.options.length + 1)} value={f.options.join("\n")}
                  onChange={e => editField(i, x => { x.options = e.target.value.split("\n"); })} /></label>
            )}
          </div>
        ))}
        <button type="button" className="add" onClick={() => update(d => {
          d.fields.push({ id: "f_" + newId(), label: "שדה חדש", hint: "", kind: "text", options: [], placeholder: "", summaryLabel: "שדה חדש", barLabel: "שדה חדש" });
        })}><Icon.plus />שדה חדש</button>
      </div>
    </div>
  );
}
