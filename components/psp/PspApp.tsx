"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProgramId, PspContent, PspVersionMeta } from "@/lib/psp/types";
import FlowView from "./FlowView";
import QAView from "./QAView";
import { HistoryView, SettingsView, SmsTemplatesView } from "./AdminViews";
import { Icon } from "./icons";
import { LoginDialog, NAME_KEY, SaveDialog, localStorageGet, localStorageSet } from "./adminKit";

export type Updater = (fn: (draft: PspContent) => void) => void;
type View = "flow" | "qa" | "sms" | "settings" | "history";

const ACCENT: Record<ProgramId, Record<string, string>> = {
  omvoh: { "--acc": "#D52B1E", "--acc-l": "#FCECEA", "--acc-d": "#A81C12" },
  ebglyss: { "--acc": "#A81C12", "--acc-l": "#F8E6E3", "--acc-d": "#7E140D" },
};

export default function PspApp({ initialContent, initialVersion, initialEditing }: {
  initialContent: PspContent; initialVersion: PspVersionMeta | null; initialEditing: boolean;
}) {
  const [prog, setProg] = useState<ProgramId>("omvoh");
  const [view, setView] = useState<View>("flow");
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [version, setVersion] = useState(initialVersion);
  // access = valid admin cookie (password already entered); editing = edit UI currently shown
  const [access, setAccess] = useState(initialEditing);
  const [editing, setEditing] = useState(initialEditing);
  const [dialog, setDialog] = useState<"login" | "save" | null>(null);
  const [toast, setToast] = useState<{ msg: string; bad?: boolean } | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = useMemo(() => content !== saved && JSON.stringify(content) !== JSON.stringify(saved), [content, saved]);

  const update: Updater = useCallback(fn => {
    setContent(c => { const d = structuredClone(c); fn(d); return d; });
  }, []);

  const flash = (msg: string, bad?: boolean) => {
    setToast({ msg, bad });
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const startEdit = (on: boolean) => setEditing(on);

  const exitEdit = async (logout: boolean) => {
    if (dirty && !confirm("יש שינויים שלא נשמרו. לצאת ממצב עריכה ולבטל אותם?")) return;
    setContent(saved);
    if (logout) { await fetch("/api/psp/auth", { method: "DELETE" }); setAccess(false); }
    startEdit(false);
    if (["sms", "settings", "history"].includes(view)) setView("flow");
  };
  const lostAccess = () => { setAccess(false); setEditing(false); setDialog("login"); };

  const applyServer = (d: { content: PspContent; version: PspVersionMeta }) => {
    setContent(d.content); setSaved(d.content); setVersion(d.version);
  };

  const restore = async (id: number) => {
    const r = await fetch("/api/psp/versions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restoreId: id, editor: localStorageGet(NAME_KEY) }),
    });
    if (r.status === 401) { lostAccess(); return; }
    if (!r.ok) { flash("השחזור נכשל", true); return; }
    applyServer(await r.json());
    flash(`גרסה #${id} שוחזרה`);
  };

  const tabs: [View, string][] = [["flow", "תרשים זרימה"], ["qa", "שאלות ותשובות"]];
  if (editing) tabs.push(["sms", "נוסחי SMS"], ["settings", "הגדרות"], ["history", "היסטוריה"]);
  const wide = editing && view === "flow";

  return (
    <div className="psp" dir="rtl" lang="he" style={ACCENT[prog] as React.CSSProperties}>
      <header className="hd">
        <div className="hd-in">
          <div className="logos">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lg-sharan" src="/psp/sharan.png" alt="שרן — רפואה עד הבית" />
            <span className="rule" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lg-lilly" src="/psp/lilly.png" alt="Lilly" />
          </div>
          <div className="ttl"><strong>{content.header.title}</strong><span>{content.header.sub}</span></div>
          <div className="seg" role="group" aria-label="תוכנית">
            {(["omvoh", "ebglyss"] as const).map(p => (
              <button key={p} aria-pressed={prog === p} onClick={() => setProg(p)}>{content.programs[p].label}</button>
            ))}
          </div>
          <div className="hd-tools">
            {!editing && (
              <button type="button" className="hd-ic" onClick={() => access ? startEdit(true) : setDialog("login")} title="כניסת אדמין למצב עריכה">
                <Icon.lock /><span>אדמין</span>
              </button>
            )}
            {/* Full navigation on purpose: lets the unsaved-changes beforeunload prompt fire. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="hd-ic" href="/" title="בחירת פלטפורמה" aria-label="חזרה לבחירת פלטפורמה"><Icon.home /></a>
          </div>
        </div>
      </header>

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

      <nav className="views" aria-label="תצוגה">
        <div className={`views-in${wide ? " wide" : ""}`}>
          {tabs.map(([v, l]) => <button key={v} aria-pressed={view === v} onClick={() => { setView(v); window.scrollTo({ top: 0 }); }}>{l}</button>)}
        </div>
      </nav>

      <div className={`wrap${wide ? " wide" : ""}`}>
        {view === "flow" && <FlowView key={prog} content={content} prog={prog} editing={editing} update={update} />}
        {view === "qa" && <QAView content={content} prog={prog} editing={editing} update={update} />}
        {view === "sms" && editing && <SmsTemplatesView content={content} update={update} />}
        {view === "settings" && editing && <SettingsView content={content} update={update} />}
        {view === "history" && editing && <HistoryView current={version} dirty={dirty} onRestore={restore} />}
      </div>

      {dialog === "login" && (
        <LoginDialog onClose={() => setDialog(null)} onOk={() => { setDialog(null); setAccess(true); startEdit(true); flash("מצב עריכה פעיל"); }} />
      )}
      {dialog === "save" && (
        <SaveDialog onClose={() => setDialog(null)} onSave={async (editor, note) => {
          localStorageSet(NAME_KEY, editor);
          const r = await fetch("/api/psp/content", {
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
