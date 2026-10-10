"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { NBlock, NNode, NucalaContent, Tone } from "@/lib/nucala/types";
import type { PspVersionMeta } from "@/lib/psp/types";
import { rich } from "@/lib/psp/format";
import { copyText, CopyBlock } from "@/components/psp/copy";
import { Icon } from "@/components/psp/icons";
import { HistoryView } from "@/components/psp/AdminViews";
import { LoginDialog, NAME_KEY, SaveDialog, localStorageGet, localStorageSet } from "@/components/psp/adminKit";
import NodeEditor from "./NodeEditor";
import SettingsView from "./SettingsView";

export type NUpdater = (fn: (draft: NucalaContent) => void) => void;
type Tab = "script" | "settings" | "history";

export const TONE: Record<Tone, { bg: string; fg: string }> = {
  teal: { bg: "var(--teal-tint)", fg: "var(--teal-dark)" },
  amber: { bg: "var(--amber-tint)", fg: "var(--amber)" },
  purple: { bg: "var(--purple-tint)", fg: "var(--purple)" },
  coral: { bg: "var(--coral-tint)", fg: "var(--coral)" },
  pink: { bg: "var(--pink-tint)", fg: "var(--pink)" },
  gray: { bg: "var(--gray-tint)", fg: "var(--gray)" },
};
const WHO = { nurse: "אחות", patient: "מטופל", family: "בן משפחה" } as const;

export default function NucalaApp({ initialContent, initialVersion, initialEditing }: {
  initialContent: NucalaContent; initialVersion: PspVersionMeta | null; initialEditing: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  const [access, setAccess] = useState(initialEditing);
  const [editing, setEditing] = useState(initialEditing);
  const [tab, setTab] = useState<Tab>("script");
  const [dialog, setDialog] = useState<"login" | "save" | null>(null);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);

  const [path, setPath] = useState<string[]>([initialContent.start]);
  const [patient, setPatient] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const byId = useMemo(() => new Map(content.nodes.map(x => [x.id, x])), [content.nodes]);
  const sections = useMemo(() => new Map(content.sections.map(x => [x.id, x])), [content.sections]);
  // Drop trail entries whose node was deleted in the editor.
  const livePath = path.filter(id => byId.has(id));
  const trail = livePath.length ? livePath : [content.start];
  const cur = byId.get(trail[trail.length - 1]) ?? content.nodes[0];

  const dirty = useMemo(() => content !== saved && JSON.stringify(content) !== JSON.stringify(saved), [content, saved]);
  const update: NUpdater = useCallback(fn => {
    setContent(c => { const d = structuredClone(c); fn(d); return d; });
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const flash = (msg: string, bad?: boolean) => {
    setToast({ msg, bad });
    setTimeout(() => setToast(null), 3000);
  };
  const top = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const goTo = (id: string) => { setPath([...trail, id]); top(); };
  const back = () => { if (trail.length > 1) { setPath(trail.slice(0, -1)); top(); } };
  const home = () => { setPath([content.start]); setPatient({}); setChecks(new Set()); top(); };
  const jumpTo = (i: number) => { setPath(trail.slice(0, i + 1)); top(); };
  const editNode = (id: string) => { setPath(id === content.start ? [id] : [content.start, id]); };

  const summaryText = () => {
    const lines: string[] = [];
    const filled = content.fields.filter(f => patient[f.id]?.trim());
    if (filled.length) {
      filled.forEach(f => lines.push(`${f.summaryLabel}: ${patient[f.id].trim()}`));
      lines.push("----------------------------------------");
    }
    const seen = new Set<string>();
    trail.forEach(id => { const s = byId.get(id)?.summary?.trim(); if (s) seen.add(s); });
    lines.push(seen.size ? [...seen].join(", ") + "." : content.header.emptySummary);
    return lines.join("\n");
  };
  const copySummary = () => copyText(summaryText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2200); });

  const applyServer = (d: { content: NucalaContent; version: PspVersionMeta }) => {
    setContent(d.content); setSaved(d.content); setVersion(d.version);
  };
  const lostAccess = () => { setAccess(false); setEditing(false); setDialog("login"); };
  const exitEdit = async (logout: boolean) => {
    if (dirty && !confirm("יש שינויים שלא נשמרו. לצאת ממצב עריכה ולבטל אותם?")) return;
    setContent(saved);
    if (logout) { await fetch("/api/psp/auth", { method: "DELETE" }); setAccess(false); }
    setEditing(false); setTab("script");
  };
  const restore = async (id: number) => {
    const r = await fetch("/api/nucala/versions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restoreId: id, editor: localStorageGet(NAME_KEY) }),
    });
    if (r.status === 401) { lostAccess(); return; }
    if (!r.ok) { flash("השחזור נכשל", true); return; }
    applyServer(await r.json());
    flash(`גרסה #${id} שוחזרה`);
  };

  const barFields = content.fields.filter(f => patient[f.id]?.trim());
  const sec = sections.get(cur.section);
  const tone = TONE[sec?.tone ?? "teal"];
  const pct = Math.max(0, Math.min(100, cur.pct || 0));

  const card = (
    <div className="n-card">
      <div className="n-card-head">
        <span className="n-chip" style={{ background: tone.bg, color: tone.fg }}>{sec?.name ?? ""}</span>
        <h2>{cur.title}</h2>
      </div>
      <div className="n-card-body">
        {cur.blocks.map((b, i) => (
          <Block key={i} b={b} bi={i} node={cur} content={content} patient={patient} setPatient={setPatient}
            checks={checks} setChecks={setChecks} lead={cur.cards && i === 0 && b.type === "p"} />
        ))}
        {cur.cards ? (
          <div className="n-routes">
            {cur.choices.map((c, i) => {
              const t = byId.get(c.to);
              const tt = TONE[sections.get(t?.section ?? "")?.tone ?? "teal"];
              return (
                <button key={c.id} type="button" className="n-route" disabled={!t} onClick={() => t && goTo(c.to)}>
                  <span className="ricon" style={{ background: tt.bg, color: tt.fg }}>{i + 1}</span>
                  <span><b>{c.label}</b>{c.desc && <span className="d">{c.desc}</span>}</span>
                </button>
              );
            })}
          </div>
        ) : cur.choices.length > 0 && (
          <div className="n-choices">
            {cur.choices.map(c => {
              const ok = byId.has(c.to);
              return (
                <button key={c.id} type="button" className={`n-choice${c.primary ? " primary" : ""}${ok ? "" : " broken"}`}
                  disabled={!ok} title={ok ? undefined : "הכפתור לא מחובר למסך"} onClick={() => ok && goTo(c.to)}>
                  <span>{c.label}</span><span className="arrow">◂</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`psp nuc${barFields.length ? " has-bar" : ""}`} dir="rtl" lang="he">
      {editing && (
        <div className="ebar">
          <div className="ebar-in">
            <span className={`ebar-st${dirty ? " dirty" : ""}`}>
              <i />
              <span>{dirty ? "יש שינויים שלא נשמרו" : "מצב עריכה — הכל שמור"}</span>
              <small>{version ? `גרסה #${version.id}` : "תוכן ברירת מחדל"}</small>
            </span>
            <button type="button" disabled={!dirty} onClick={() => { if (confirm("לבטל את כל השינויים מאז השמירה האחרונה?")) setContent(saved); }}>ביטול שינויים</button>
            <button type="button" className="pri" disabled={!dirty} onClick={() => setDialog("save")}>שמירה</button>
            <button type="button" onClick={() => exitEdit(false)}>יציאה ממצב עריכה</button>
            <button type="button" onClick={() => exitEdit(true)} title="בפעם הבאה תידרש שוב הסיסמה">התנתקות אדמין</button>
          </div>
        </div>
      )}

      <header className="n-top">
        <div className="n-top-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gsk" src="/gsk/gsk.png" alt="GSK" />
          <div className="n-top-tx">
            <h1>{content.header.title}</h1>
            <p>{content.header.sub}</p>
          </div>
          <div className="n-top-tools">
            {content.header.badge && <span className="n-badge">{content.header.badge}</span>}
            {!editing && (
              <button type="button" className="hd-ic" onClick={() => access ? setEditing(true) : setDialog("login")} title="כניסת אדמין למצב עריכה">
                <Icon.lock /><span>אדמין</span>
              </button>
            )}
            {/* Full navigation on purpose: lets the unsaved-changes beforeunload prompt fire. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="hd-ic" href="/" title="בחירת תוכנית" aria-label="חזרה לבחירת תוכנית"><Icon.home /></a>
          </div>
        </div>
      </header>

      {editing && (
        <nav className="n-tabs" aria-label="עריכה">
          {([["script", "תסריט"], ["settings", "הגדרות"], ["history", "היסטוריה"]] as [Tab, string][]).map(([t, l]) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>{l}</button>
          ))}
        </nav>
      )}

      {tab === "script" && <>
        <div className={`n-trailwrap${editing ? " ed-on" : ""}`}>
          <div className="n-trailwrap-in">
            <div className="n-toprow">
              <button type="button" className="n-navbtn" onClick={back} disabled={trail.length <= 1}>→ אחורה</button>
              <button type="button" className="n-navbtn home" onClick={home}>⌂ תחילת המסלול</button>
            </div>
            <div className="n-trail" ref={el => { if (el) el.scrollLeft = -el.scrollWidth; }}>
              {trail.map((id, i) => (
                <span key={i} style={{ display: "contents" }}>
                  <button type="button" className={`n-tnode${i === trail.length - 1 ? " cur" : ""}`} onClick={() => jumpTo(i)}>
                    <span className="dot" /><span className="lbl">{byId.get(id)?.track}</span>
                  </button>
                  {i < trail.length - 1 && <span className="n-tline" />}
                </span>
              ))}
            </div>
            <div className="n-prow"><span className="n-ppct">{pct}%</span><span className="n-plbl">התקדמות בשיחה</span></div>
            <div className="n-pbar"><div className="n-pfill" style={{ width: pct + "%" }} /></div>
          </div>
        </div>

        <main className={`n-main${editing ? " wide" : ""}`}>
          {editing ? (
            <div className="split">
              <NodeEditor content={content} node={cur} update={update} onPick={editNode} />
              <div className="pv"><p className="pv-tag">תצוגה חיה — כך הנציגה רואה את המסך</p>{card}</div>
            </div>
          ) : card}
        </main>
        <footer className="n-footer">{content.header.footer}</footer>
      </>}

      {tab === "settings" && editing && <main className="n-main"><SettingsView content={content} update={update} /></main>}
      {tab === "history" && editing && (
        <main className="n-main"><HistoryView current={version} dirty={dirty} onRestore={restore} endpoint="/api/nucala/versions" /></main>
      )}

      {barFields.length > 0 && (
        <div className="n-pbar-fixed">
          <div className="n-pbar-in">
            <span className="n-pbar-title">פרטי מטופל</span>
            {barFields.map(f => (
              <span key={f.id} className="n-pbar-item">
                {f.barLabel ? <>{f.barLabel}: <b>{patient[f.id]}</b></> : patient[f.id]}
              </span>
            ))}
          </div>
        </div>
      )}
      {!editing && (
        <button type="button" className="n-copybtn" onClick={copySummary} title="העתק סיכום שיחה">
          <Icon.copy /><span>{copied ? "הסיכום הועתק ✓" : "העתק סיכום שיחה"}</span>
        </button>
      )}

      {dialog === "login" && (
        <LoginDialog onClose={() => setDialog(null)} onOk={() => { setDialog(null); setAccess(true); setEditing(true); flash("מצב עריכה פעיל"); }} />
      )}
      {dialog === "save" && (
        <SaveDialog placeholder="למשל: עדכון נוסח מסך הפתיחה" onClose={() => setDialog(null)} onSave={async (editor, note) => {
          localStorageSet(NAME_KEY, editor);
          const r = await fetch("/api/nucala/content", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content, editor, note, baseVersion: version?.id ?? null }),
          });
          if (r.status === 401) { lostAccess(); return "תוקף הכניסה פג — יש להזין שוב את סיסמת האדמין."; }
          if (r.status === 409) return "מישהי אחרת שמרה גרסה חדשה בזמן שערכת. כדאי להעתיק את השינויים, לרענן את הדף ולערוך מחדש.";
          if (!r.ok) return "השמירה נכשלה. נסי שוב.";
          applyServer(await r.json());
          setDialog(null);
          flash("נשמר");
          return null;
        }} />
      )}
      {toast && <div className={`toast${toast.bad ? " bad" : ""}`} role="status">{toast.msg}</div>}
    </div>
  );
}

function Block({ b, bi, node, content, patient, setPatient, checks, setChecks, lead }: {
  b: NBlock; bi: number; node: NNode; content: NucalaContent;
  patient: Record<string, string>; setPatient: (f: (p: Record<string, string>) => Record<string, string>) => void;
  checks: Set<string>; setChecks: (s: Set<string>) => void; lead?: boolean;
}) {
  const html = (s: string) => ({ __html: rich(s) });
  switch (b.type) {
    case "line":
      return <div className="n-line"><span className={`n-who ${b.who}`}>{WHO[b.who]}</span><div className="txt" dangerouslySetInnerHTML={html(b.text)} /></div>;
    case "p": return <p className={lead ? "lead" : undefined} dangerouslySetInnerHTML={html(b.text)} />;
    case "h": return <h4 className="n-sub">{b.text}</h4>;
    case "ul": return <ul className="plain">{b.items.filter(x => x.trim()).map((x, i) => <li key={i} dangerouslySetInnerHTML={html(x)} />)}</ul>;
    case "ol": return <ol className="steps" start={b.start}>{b.items.filter(x => x.trim()).map((x, i) => <li key={i} dangerouslySetInnerHTML={html(x)} />)}</ol>;
    case "note": return <div className="n-note" dangerouslySetInnerHTML={html(b.text)} />;
    case "warn": return <div className="n-warn" dangerouslySetInnerHTML={html(b.text)} />;
    case "copy": return <CopyBlock title={b.title} text={b.text} />;
    case "cols":
      return (
        <div className="n-cols">
          {b.cols.map((c, i) => (
            <div key={i}><h4 className="n-sub">{c.title}</h4>
              <ul className="plain">{c.items.filter(x => x.trim()).map((x, j) => <li key={j} dangerouslySetInnerHTML={html(x)} />)}</ul></div>
          ))}
        </div>
      );
    case "checklist":
      return (
        <div className="n-cl">
          <div className="n-cl-title">{b.title}</div>
          {b.items.filter(x => x.trim()).map((x, i) => {
            const k = `${node.id}|${bi}|${i}`, on = checks.has(k);
            return (
              <label key={i} className={`n-cl-item${on ? " on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => {
                  const s = new Set(checks); if (on) s.delete(k); else s.add(k); setChecks(s);
                }} />
                <span className="n-cl-box"><i /></span>
                <span className="n-cl-text" dangerouslySetInnerHTML={html(x)} />
              </label>
            );
          })}
        </div>
      );
    case "form":
      return <>
        <div className="n-formgrid">
          {content.fields.map(f => (
            <label key={f.id} className={`n-ff${f.full ? " full" : ""}`}>
              <span>{f.label}{f.hint && <> <i>{f.hint}</i></>}</span>
              {f.kind === "select" ? (
                <select value={patient[f.id] ?? ""} onChange={e => setPatient(p => ({ ...p, [f.id]: e.target.value }))}>
                  <option value="">{f.placeholder || "בחירה"}</option>
                  {f.options.filter(o => o.trim()).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input type="text" value={patient[f.id] ?? ""} placeholder={f.placeholder}
                  onChange={e => setPatient(p => ({ ...p, [f.id]: e.target.value }))} />
              )}
            </label>
          ))}
        </div>
        {content.header.formHint && <p className="n-formhint">{content.header.formHint}</p>}
      </>;
  }
}
