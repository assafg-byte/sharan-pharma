"use client";

import { useEffect, useState } from "react";
import type { PspContent, PspVersionMeta } from "@/lib/psp/types";
import { newId } from "@/lib/psp/format";
import { Icon } from "./icons";
import type { Updater } from "./PspApp";

/** Where each SMS template is used — shown before deleting one. */
function smsUsage(c: PspContent, key: string): number {
  let n = 0;
  for (const p of Object.values(c.programs))
    for (const s of Object.values(p.screens)) n += s.sms.filter(m => m.key === key).length;
  for (const t of c.qa) for (const it of t.items) n += it.blocks.filter(b => b.type === "sms" && b.key === key).length;
  return n;
}

export function SmsTemplatesView({ content, update }: { content: PspContent; update: Updater }) {
  return (
    <div className="pg">
      <div className="pg-hd">
        <h1>נוסחי SMS</h1>
        <p>עריכה כאן מתעדכנת בכל מקום שבו הנוסח מופיע — בתרשים הזרימה ובשאלות ותשובות.</p>
      </div>
      {Object.entries(content.sms).map(([key, t]) => (
        <div key={key} className="card-ed">
          <h2>
            <span className="sp">{t.t || "נוסח ללא שם"}</span>
            <span className="k">{smsUsage(content, key)} שימושים</span>
            <button type="button" className="ib del" aria-label="מחיקת הנוסח" title="מחיקה" onClick={() => {
              const n = smsUsage(content, key);
              const msg = n ? `הנוסח מופיע ב-${n} מקומות, והוא יוסר מכולם. למחוק?` : "למחוק את הנוסח?";
              if (confirm(msg)) update(d => {
                delete d.sms[key];
                for (const p of Object.values(d.programs))
                  for (const s of Object.values(p.screens)) s.sms = s.sms.filter(m => m.key !== key);
                for (const tp of d.qa) for (const it of tp.items) it.blocks = it.blocks.filter(b => !(b.type === "sms" && b.key === key));
              });
            }}><Icon.trash /></button>
          </h2>
          <div className="grid2">
            <label className="fld"><span>שם הנוסח</span>
              <input className="inp" value={t.t} onChange={e => update(d => { d.sms[key].t = e.target.value; })} />
            </label>
            <label className="fld"><span>מתי נשלח (הסבר)</span>
              <input className="inp" value={t.sub} onChange={e => update(d => { d.sms[key].sub = e.target.value; })} />
            </label>
          </div>
          <label className="fld" style={{ marginBottom: 0 }}><span>הנוסח</span>
            <textarea className="inp" rows={Math.max(4, t.body.split("\n").length + 1)} value={t.body}
              onChange={e => update(d => { d.sms[key].body = e.target.value; })} />
          </label>
        </div>
      ))}
      <button type="button" className="add" onClick={() => update(d => {
        d.sms["sms_" + newId()] = { t: "נוסח חדש", sub: "", body: "" };
      })}><Icon.plus />נוסח SMS חדש</button>
    </div>
  );
}

export function SettingsView({ content, update }: { content: PspContent; update: Updater }) {
  const set = content.settings.omvoh;
  const num = (v: string) => Math.max(0, Math.min(200, parseInt(v, 10) || 0));
  const common: [keyof PspContent["common"], string][] = [
    ["newPatient", "כפתור — מטופל חדש"], ["prevQuestion", "כפתור — שאלה קודמת"],
    ["smsHeading", "כותרת אזור נוסחי ה-SMS"], ["unknownDate", "טקסט כשתאריך לא ידוע"],
  ];
  return (
    <div className="pg">
      <div className="pg-hd"><h1>הגדרות</h1><p>טקסטים כלליים וספי החישוב של תרשים הזרימה.</p></div>

      <div className="card-ed">
        <h2>כותרת הדף</h2>
        <div className="grid2">
          <label className="fld"><span>כותרת</span>
            <input className="inp" value={content.header.title} onChange={e => update(d => { d.header.title = e.target.value; })} /></label>
          <label className="fld"><span>שורת משנה</span>
            <input className="inp" value={content.header.sub} onChange={e => update(d => { d.header.sub = e.target.value; })} /></label>
          <label className="fld"><span>שם תוכנית — Omvoh</span>
            <input className="inp" value={content.programs.omvoh.label} onChange={e => update(d => { d.programs.omvoh.label = e.target.value; })} /></label>
          <label className="fld"><span>שם תוכנית — Ebglyss</span>
            <input className="inp" value={content.programs.ebglyss.label} onChange={e => update(d => { d.programs.ebglyss.label = e.target.value; })} /></label>
        </div>
      </div>

      <div className="card-ed">
        <h2>טקסטים כלליים</h2>
        <div className="grid2">
          {common.map(([k, l]) => (
            <label key={k} className="fld"><span>{l}</span>
              <input className="inp" value={content.common[k]} onChange={e => update(d => { d.common[k] = e.target.value; })} /></label>
          ))}
        </div>
      </div>

      <div className="card-ed">
        <h2>תווית &quot;חדש&quot; בשאלות ותשובות</h2>
        <p className="hint" style={{ margin: "0 0 12px" }}>שאלה שנוספה מציגה תווית &quot;חדש&quot; כדי שהעובדים ישימו לב אליה. התווית נעלמת מכל שאלה בנפרד אחרי מספר הימים שנקבע כאן, מרגע הוספתה. 0 = ללא תווית.</p>
        <div className="grid2">
          <label className="fld"><span>ימים להצגת התווית</span>
            <input className="inp num" type="number" min={0} max={365} value={content.settings.qaNewDays}
              onChange={e => update(d => { d.settings.qaNewDays = Math.max(0, Math.min(365, parseInt(e.target.value, 10) || 0)); })} /></label>
        </div>
      </div>

      <div className="card-ed">
        <h2>חישובי אומבו</h2>
        <p className="hint" style={{ margin: "0 0 12px" }}>שינוי כאן משנה לאיזה ענף המטופל מנותב. הטקסטים שמשתמשים ב-<code>{"{ivWeeks}"}</code> ו-<code>{"{moveWeeks}"}</code> מתעדכנים לבד.</p>
        <div className="grid2">
          <label className="fld"><span>שלב IV — פחות מ-X שבועות מהעירוי הראשון</span>
            <input className="inp num" type="number" value={set.ivStageWeeks} onChange={e => update(d => { d.settings.omvoh.ivStageWeeks = num(e.target.value); })} /></label>
          <label className="fld"><span>שלב מעבר — עד X שבועות (מעל = מטופל פעיל)</span>
            <input className="inp num" type="number" value={set.moveStageWeeks} onChange={e => update(d => { d.settings.omvoh.moveStageWeeks = num(e.target.value); })} /></label>
          <label className="fld"><span>עירוי ראשון לא ידוע — שבועות מהמנה האחרונה עד המעבר ל-SC</span>
            <input className="inp num" type="number" value={set.moveFromLastWeeks} onChange={e => update(d => { d.settings.omvoh.moveFromLastWeeks = num(e.target.value); })} /></label>
        </div>
        <div className="fld"><span>שבועות מעירוי מספר N עד שיחת המעבר ל-SC (עירוי 3 מוביל ישירות לתיאום הדרכה)</span>
          <div className="offs">
            {Object.keys(set.infOffsets).sort((a, b) => +a - +b).map(k => (
              <label key={k}>עירוי {k}
                <input className="inp num" type="number" value={set.infOffsets[k]} disabled={k === "3"}
                  onChange={e => update(d => { d.settings.omvoh.infOffsets[k] = num(e.target.value); })} />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });

export function HistoryView({ current, dirty, onRestore, endpoint = "/api/psp/versions" }: {
  current: PspVersionMeta | null; dirty: boolean; onRestore: (id: number) => Promise<void>; endpoint?: string;
}) {
  const [rows, setRows] = useState<PspVersionMeta[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    fetch(endpoint).then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { if (live) setRows(d); })
      .catch(() => { if (live) setErr("לא הצלחנו לטעון את ההיסטוריה."); });
    return () => { live = false; };
  }, [current?.id, endpoint]);

  return (
    <div className="pg">
      <div className="pg-hd">
        <h1>היסטוריית גרסאות</h1>
        <p>כל שמירה יוצרת גרסה. שחזור יוצר גרסה חדשה עם התוכן הישן — שום דבר לא נמחק.</p>
      </div>
      {err && <p className="err">{err}</p>}
      {!rows && !err && <p className="empty">טוען…</p>}
      {rows && !rows.length && <p className="empty">עדיין אין גרסאות שמורות. התוכן הנוכחי הוא תוכן ברירת המחדל.</p>}
      {rows?.map(v => (
        <div key={v.id} className="ver">
          <span className="n">#{v.id}</span>
          <span className="m">
            <b>{v.note || "שמירה"}</b>
            <small>{v.editor || "ללא שם"} · {when(v.createdAt)}</small>
          </span>
          {current?.id === v.id
            ? <span className="cur">הגרסה הנוכחית</span>
            : <button type="button" className="btn" disabled={busy !== null} onClick={async () => {
                const msg = dirty ? `יש שינויים שלא נשמרו — הם יאבדו. לשחזר את גרסה #${v.id}?` : `לשחזר את גרסה #${v.id}?`;
                if (!confirm(msg)) return;
                setBusy(v.id);
                try { await onRestore(v.id); } finally { setBusy(null); }
              }}>{busy === v.id ? "משחזר…" : "שחזור"}</button>}
        </div>
      ))}
    </div>
  );
}
