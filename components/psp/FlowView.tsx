"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProgramId, PspContent, ScreenContent } from "@/lib/psp/types";
import { EMPTY_STATE, FLOW, sampleState, screenContext, screenDef, type FlowState, type ScreenCtx } from "@/lib/psp/screens";
import { fmt, midnight, resolveDue, rich, weeksBetween, fillVars } from "@/lib/psp/format";
import DatePicker from "./DatePicker";
import ScreenEditor from "./ScreenEditor";
import { SmsCard } from "./copy";
import { Icon } from "./icons";
import type { Updater } from "./PspApp";

type Step = { id: string; label?: string };

export default function FlowView({ content, prog, editing, update }: {
  content: PspContent; prog: ProgramId; editing: boolean; update: Updater;
}) {
  const [path, setPath] = useState<Step[]>([{ id: "start" }]);
  const [st, setSt] = useState<FlowState>(EMPTY_STATE);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ title: string; body: string } | null>(null);
  const today = useMemo(() => midnight(), []);

  const id = path[path.length - 1].id;
  const def = screenDef(prog, id);
  const sc = content.programs[prog].screens[id];
  const ctx = screenContext(prog, id, st, content.settings.omvoh, today);

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const go = (next: string, label?: string, patch?: Partial<FlowState>) => {
    if (patch) setSt(s => ({ ...s, ...patch }));
    setChecked(new Set());
    setPath(p => [...p, { id: next, label }]);
    const nsc = content.programs[prog].screens[next];
    if (prog === "omvoh" && next === "B_NO" && nsc?.texts.modal) {
      setModal({ title: nsc.texts.modalTitle || "", body: nsc.texts.modal });
    }
    scrollTop();
  };
  const back = (i: number) => {
    setChecked(new Set());
    setPath(p => p.slice(0, i + 1));
    if (i === 0) setSt(EMPTY_STATE);
    scrollTop();
  };
  const jump = (to: string) => {
    setSt(sampleState(prog, to, today));
    setChecked(new Set());
    setPath(to === "start" ? [{ id: "start" }] : [{ id: "start" }, { id: to, label: screenDef(prog, to)?.name }]);
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);

  if (!def || !sc) return null;
  const tx = sc.texts;

  const screen = (() => {
    switch (id) {
      case "V_DATES": return <VDates key={path.length} tx={tx} onDone={(a, b) => go("V_TASKS", `SC ${fmt(a)} · הדרכה ${fmt(b)}`, { scDate: a, trDate: b })} />;
      case "C_DATES": return <CDates key={path.length} tx={tx} onDone={(a, b) => {
        const same = a.getTime() === b.getTime();
        go(same ? "C_EQ" : "C_NEQ", same ? "התאריכים זהים" : "התאריכים שונים", { scDate: a, trDate: b });
      }} />;
      case "NEW": return <NewForm key={path.length} tx={tx} iv={st.iv}
        onUnknown={() => go("UNK", "תאריך עירוי לא ידוע")}
        onDone={d => go("stage", fmt(d), { iv: d })} />;
      case "UNK": return <UnkForm key={path.length} tx={tx} st={st} infs={Object.keys(content.settings.omvoh.infOffsets).map(Number).sort((a, b) => a - b)}
        onDone={(d, type, inf) => {
          if (type === "SC") go("C1", "SC · " + fmt(d), { iv: null, lastDate: d, lastType: "SC", infNo: null });
          else if (inf === 3) go("TRAIN", `עירוי 3 · ${fmt(d)}`, { lastDate: d, lastType: "IV", infNo: 3 });
          else go("A1U", `עירוי ${inf} · ${fmt(d)}`, { lastDate: d, lastType: "IV", infNo: inf });
        }} />;
      case "stage": return <Stage tx={tx} sc={sc} ctx={ctx} st={st} today={today} content={content} go={go} />;
    }
    if (def.kind === "question") {
      const sub = id === "C1" ? (st.iv ? tx.subIv : tx.subSc) : tx.sub;
      return <Shell tx={tx} sub={sub} vars={ctx.vars}><Answers def={def.answers} sc={sc} go={go} /></Shell>;
    }
    return <TaskScreen content={content} sc={sc} ctx={ctx} screenKey={`${prog}|${id}`}
      checked={checked} setChecked={setChecked} def={def} go={go}
      acts={<Acts content={content} onNew={() => back(0)} onPrev={() => back(path.length - 2)} />} />;
  })();

  const view = (
    <>
      <div className="trail">
        {path.length > 1 && <>
          <button onClick={() => back(0)}>התחלה</button>
          {path.slice(1).map((p, i) => p.label ? (
            <span key={i} style={{ display: "contents" }}><i>›</i><button onClick={() => back(i + 1)}>{p.label}</button></span>
          ) : null)}
        </>}
      </div>
      {screen}
    </>
  );

  return (
    <>
      {editing ? (
        <div className="split">
          <ScreenEditor prog={prog} id={id} content={content} update={update} onJump={jump} screens={FLOW[prog]} />
          <div className="pv"><p className="pv-tag">תצוגה חיה — כך הנציגה רואה את המסך</p>{view}</div>
        </div>
      ) : view}
      {modal && (
        <div className="ovl" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="mdl" role="dialog" aria-modal="true">
            <h3>{modal.title}</h3>
            <p dangerouslySetInnerHTML={{ __html: rich(modal.body) }} />
            <button autoFocus onClick={() => setModal(null)}>הבנתי</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- building blocks ---------------- */

function Shell({ tx, sub, vars, children, mid }: {
  tx: Record<string, string>; sub?: string; vars?: Record<string, string>; children: React.ReactNode; mid?: boolean;
}) {
  const s = rich(sub, vars);
  return (
    <section className="step">
      <div className="step-top">{fillVars(tx.step || "", vars)}</div>
      <div className={`step-bd${mid ? " mid" : ""}`}>
        <h1 className="q" dangerouslySetInnerHTML={{ __html: rich(tx.title, vars) }} />
        {s && <p className="sub" dangerouslySetInnerHTML={{ __html: s }} />}
        {children}
      </div>
    </section>
  );
}

function Answers({ def, sc, go, only, next }: {
  def?: { key: string; to: string }[]; sc: ScreenContent; go: (to: string, label?: string) => void; only?: string[];
  /** Continue-buttons under a task list — highlighted so they stand out from the tasks. */
  next?: boolean;
}) {
  const list = (def ?? []).filter(a => !only || only.includes(a.key));
  if (!list.length) return null;
  return (
    <div className={`ans${next ? " next" : ""}`}>
      {list.map(a => {
        const ans = sc.answers[a.key] ?? { l: a.key, s: "" };
        return (
          <button key={a.key} onClick={() => go(a.to, ans.l)}>
            <span>{ans.l}{ans.s && <small>{ans.s}</small>}</span><Icon.chev />
          </button>
        );
      })}
    </div>
  );
}

function Acts({ content, onNew, onPrev }: { content: PspContent; onNew: () => void; onPrev: () => void }) {
  return (
    <div className="acts">
      <button onClick={onNew}>{content.common.newPatient}</button>
      <button onClick={onPrev}>{content.common.prevQuestion}</button>
    </div>
  );
}

function TaskScreen({ content, sc, ctx, screenKey, checked, setChecked, def, go, acts }: {
  content: PspContent; sc: ScreenContent; ctx: ScreenCtx; screenKey: string;
  checked: Set<string>; setChecked: (s: Set<string>) => void;
  def: NonNullable<ReturnType<typeof screenDef>>; go: (to: string, label?: string) => void; acts: React.ReactNode;
}) {
  const tx = sc.texts;
  const show = (cond?: string) => !cond || ctx.conds[cond] !== false;
  const toggle = (k: string) => { const n = new Set(checked); if (n.has(k)) n.delete(k); else n.add(k); setChecked(n); };
  const unknown = content.common.unknownDate;
  const smsList = sc.sms.filter(m => show(m.cond) && content.sms[m.key]);

  return (
    <Shell tx={tx} sub={tx.sub} vars={ctx.vars}>
      {sc.groups.map(g => {
        const tasks = g.tasks.filter(t => show(t.cond));
        if (!tasks.length) return null;
        const done = tasks.filter(t => checked.has(`${screenKey}|${t.id}`)).length;
        const prog = <span className="prog"> · {done} מתוך {tasks.length} בוצעו</span>;
        return (
          <div key={g.id} className={`calc${done === tasks.length ? " alldone" : ""}`}>
            {g.right
              ? <div className="calc-hd"><span>{g.title}{prog}</span><span>{g.right}</span></div>
              : <h4>{g.title}{prog}</h4>}
            {tasks.map(t => {
              const k = `${screenKey}|${t.id}`, on = checked.has(k);
              const due = resolveDue(t.due, ctx.bases, unknown);
              const sub = rich(t.sub, ctx.vars);
              return (
                <div key={t.id} className={`row task${on ? " done" : ""}`} onClick={e => { if (!(e.target as HTMLElement).closest(".tick")) toggle(k); }}>
                  <label className="tick">
                    <input type="checkbox" checked={on} onChange={() => toggle(k)} aria-label="סימון משימה כבוצעה" />
                    <span className="box" />
                  </label>
                  <span className="k">
                    <span className="t" dangerouslySetInnerHTML={{ __html: rich(t.title, ctx.vars) }} />
                    {sub && <span className="s" dangerouslySetInnerHTML={{ __html: sub }} />}
                  </span>
                  {due.kind === "date" && <b><span className="date-pill">{fmt(due.date)}</span></b>}
                  {due.kind === "text" && <b className="txt">{due.text}</b>}
                </div>
              );
            })}
          </div>
        );
      })}
      {tx.note && <div className="noteb" dangerouslySetInnerHTML={{ __html: rich(tx.note, ctx.vars) }} />}
      {tx.keep && <div className="keep" dangerouslySetInnerHTML={{ __html: rich(tx.keep, ctx.vars) }} />}
      {smsList.length > 0 && (
        <div className="smsw">
          <h4>{content.common.smsHeading}</h4>
          {smsList.map(m => {
            const tpl = content.sms[m.key];
            const w = resolveDue(m.when, ctx.bases, unknown);
            const when = w.kind === "date" ? fmt(w.date) : w.kind === "text" ? w.text : "";
            return <SmsCard key={m.id} title={tpl.t} sub={tpl.sub} when={when} body={tpl.body} />;
          })}
        </div>
      )}
      {def.answers && def.answers.length > 0 && <>
        {tx.flabel && <p className="flabel">{tx.flabel}</p>}
        <Answers def={def.answers} sc={sc} go={go} next />
      </>}
      {acts}
    </Shell>
  );
}

function Stage({ tx, sc, ctx, st, today, content, go }: {
  tx: Record<string, string>; sc: ScreenContent; ctx: ScreenCtx; st: FlowState; today: Date;
  content: PspContent; go: (to: string, label?: string) => void;
}) {
  if (!st.iv) return <Shell tx={tx}><p className="sub">חסר תאריך עירוי ראשון.</p></Shell>;
  const set = content.settings.omvoh;
  const w = weeksBetween(st.iv, today);
  const [stage, lab, next] = w < set.ivStageWeeks ? [tx.ivStage, tx.ivSub, "A1"]
    : w <= set.moveStageWeeks ? [tx.moveStage, tx.moveSub, "B1"]
    : [tx.activeStage, tx.activeSub, "C1"];
  const nextAns = sc.answers.next ?? { l: "המשך", s: "" };
  return (
    <Shell tx={tx} vars={ctx.vars}>
      <p className="big">{stage}</p>
      <p className="bigsub" dangerouslySetInnerHTML={{ __html: rich(lab, ctx.vars) }} />
      <div className="calc"><h4>{tx.calcTitle}</h4>
        <div className="row"><span className="k">{tx.rowIv}</span><b>{fmt(st.iv)}</b></div>
        <div className="row"><span className="k">{tx.rowToday}</span><b>{fmt(today)}</b></div>
        <div className="row"><span className="k">{tx.rowWeeks}</span><b>{w}</b></div>
      </div>
      <div className="ans">
        <button onClick={() => go(next, nextAns.l)}>
          <span>{nextAns.l}{nextAns.s && <small>{nextAns.s}</small>}</span><Icon.chev />
        </button>
      </div>
    </Shell>
  );
}

/* ---------------- forms ---------------- */

function TwoDates({ tx, onDone, missing }: {
  tx: Record<string, string>; onDone: (sc: Date, tr: Date) => void; missing: (a: Date | null, b: Date | null) => string;
}) {
  const [a, setA] = useState<Date | null>(null);
  const [b, setB] = useState<Date | null>(null);
  const [err, setErr] = useState("");
  const submit = () => { const e = missing(a, b); if (e) { setErr(e); return; } onDone(a!, b!); };
  return (
    <Shell tx={tx} sub={tx.sub}>
      <div className="dfield">
        <div><label>{tx.labelSc}</label><DatePicker value={a} onChange={setA} onEnter={submit} /></div>
        <div><label>{tx.labelTr}</label><DatePicker value={b} onChange={setB} onEnter={submit} /></div>
        <button className="go" onClick={submit}>{tx.button}</button>
      </div>
      <div className="err">{err}</div>
    </Shell>
  );
}

const VDates = ({ tx, onDone }: { tx: Record<string, string>; onDone: (a: Date, b: Date) => void }) =>
  <TwoDates tx={tx} onDone={onDone} missing={(a, b) =>
    !a && !b ? "שני התאריכים הם שדות חובה." : !a ? "חסר תאריך הזרקה עצמית SC." : !b ? "חסר תאריך הדרכה." : ""} />;

const CDates = ({ tx, onDone }: { tx: Record<string, string>; onDone: (a: Date, b: Date) => void }) =>
  <TwoDates tx={tx} onDone={onDone} missing={(a, b) =>
    !a || !b ? "שני התאריכים צריכים להיות תקינים בפורמט dd/mm/yyyy." : ""} />;

function NewForm({ tx, iv, onDone, onUnknown }: {
  tx: Record<string, string>; iv: Date | null; onDone: (d: Date) => void; onUnknown: () => void;
}) {
  const [d, setD] = useState<Date | null>(iv ?? midnight());
  const [unk, setUnk] = useState(false);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!d) { setErr("התאריך לא תקין. הפורמט הוא dd/mm/yyyy."); return; }
    if (d > midnight()) { setErr("התאריך עתידי. הזיני תאריך שכבר קרה."); return; }
    onDone(d);
  };
  return (
    <Shell tx={tx} sub={tx.sub} mid>
      <div className="dfield">
        <div>
          <DatePicker value={d} onChange={setD} max={midnight()} onEnter={submit} disabled={unk} />
          {tx.hint && <div className="dp-hint">{tx.hint}</div>}
        </div>
        <div className="chk-row">
          <label className={`chk${unk ? " on" : ""}`}>
            <input type="checkbox" checked={unk} onChange={e => {
              if (!e.target.checked) return;
              setUnk(true);
              setTimeout(onUnknown, 160);
            }} />
            <span>{tx.unknown}</span>
          </label>
        </div>
        <button className="go" disabled={unk} onClick={submit}>{tx.button}</button>
      </div>
      <div className="err">{err}</div>
    </Shell>
  );
}

function UnkForm({ tx, st, infs, onDone }: {
  tx: Record<string, string>; st: FlowState; infs: number[];
  onDone: (d: Date, type: "SC" | "IV", inf: number | null) => void;
}) {
  const [d, setD] = useState<Date | null>(st.lastDate);
  const [type, setType] = useState<"SC" | "IV" | null>(st.lastType);
  const [inf, setInf] = useState<number | null>(st.infNo);
  const [err, setErr] = useState("");
  const submit = () => {
    if (!d) { setErr("מועד קבלת התרופה האחרון הוא שדה חובה."); return; }
    if (!type) { setErr("צריך לסמן אם התרופה ניתנה ב-SC או ב-IV."); return; }
    if (type === "IV" && !inf) { setErr("צריך לבחור את מספר העירוי האחרון."); return; }
    onDone(d, type, type === "IV" ? inf : null);
  };
  const pickType = (t: "SC" | "IV") => { setType(cur => (cur === t ? null : t)); setInf(null); };
  return (
    <Shell tx={tx} sub={tx.sub} mid>
      <div className="dfield">
        <div><label>{tx.labelDate}</label><DatePicker value={d} onChange={setD} onEnter={submit} /></div>
      </div>
      <p className="flabel">{tx.typeQ}</p>
      <div className="chks">
        {(["SC", "IV"] as const).map(t => (
          <label key={t} className={`chk${type === t ? " on" : ""}`}>
            <input type="checkbox" checked={type === t} onChange={() => pickType(t)} /><span>{t}</span>
          </label>
        ))}
      </div>
      {type === "IV" && <>
        <p className="flabel">{tx.infQ}</p>
        <div className="inf">
          {infs.map(n => <button key={n} aria-pressed={inf === n} onClick={() => setInf(n)}>{n}</button>)}
        </div>
      </>}
      <button className="go" onClick={submit}>{tx.button}</button>
      <div className="err">{err}</div>
    </Shell>
  );
}
