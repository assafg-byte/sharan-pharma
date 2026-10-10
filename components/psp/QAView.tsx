"use client";

import { useMemo, useState } from "react";
import type { ProgramId, PspContent, QaBlock, QaItem, QaTopic } from "@/lib/psp/types";
import { newId, plain, rich } from "@/lib/psp/format";
import { CopyBlock } from "./copy";
import { Icon } from "./icons";
import { FormatHint, RowTools, move } from "./ScreenEditor";
import type { Updater } from "./PspApp";

const DAY_MS = 86_400_000;
/** True while the question is younger than the admin-configured "new" window. */
const isNew = (it: QaItem, days: number, now: number) =>
  days > 0 && !!it.addedAt && now - new Date(it.addedAt).getTime() < days * DAY_MS;

const blockText = (b: QaBlock, c: PspContent): string => {
  switch (b.type) {
    case "p": case "note": case "alert": return b.text;
    case "ul": case "ol": return b.items.join(" ");
    case "table": return [...b.head, ...b.rows.flat()].join(" ");
    case "copy": return b.title + " " + b.text;
    case "sms": return b.title + " " + (c.sms[b.key]?.body ?? "");
  }
};

export default function QAView({ content, prog, editing, update }: {
  content: PspContent; prog: ProgramId; editing: boolean; update: Updater;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const q = query.trim();
  const newDays = content.settings.qaNewDays;
  // Fixed for the lifetime of the view — the badge ages on reload, not mid-session
  const [now] = useState(() => Date.now());

  const topics = useMemo(() => content.qa
    .map((t, ti) => ({ t, ti }))
    .filter(({ t }) => editing || t.prog === "both" || t.prog === prog)
    .map(({ t, ti }) => ({
      t, ti,
      items: t.items.map((it, ii) => ({ it, ii })).filter(({ it }) =>
        !q || plain(it.q + " " + it.blocks.map(b => blockText(b, content)).join(" ")).includes(q)),
    }))
    .filter(x => editing || x.items.length), [content, prog, editing, q]);

  const total = topics.reduce((n, t) => n + t.items.length, 0);
  const setAll = (on: boolean) => setOpen(on ? new Set(content.qa.flatMap(t => t.items.map(i => i.id))) : new Set());
  const toggle = (id: string, on: boolean) => setOpen(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  const editTopic = (ti: number, fn: (t: QaTopic) => void) => update(d => fn(d.qa[ti]));

  return (
    <>
      <div className="qa-top">
        <div className="qa-search">
          <Icon.search />
          <input type="search" placeholder="חיפוש שאלה או מילה…" value={query} aria-label="חיפוש בשאלות ותשובות"
            onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="qa-tools">
          <button onClick={() => setAll(true)}>פתח הכל</button>
          <button onClick={() => setAll(false)}>סגור הכל</button>
        </div>
      </div>
      <nav className="qa-nav" aria-label="נושאים">
        {topics.map(({ t, items }) => (
          <button key={t.id} onClick={() => document.getElementById("qs-" + t.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            {t.t}<span>{items.length}</span>
          </button>
        ))}
      </nav>
      {!total && !editing && <p className="qa-empty">לא נמצאו שאלות עבור &quot;{q}&quot;.</p>}

      {topics.map(({ t, ti, items }) => (
        <section key={t.id} className="qs" id={"qs-" + t.id}>
          {editing ? (
            <div className="card-ed" style={{ marginBottom: 8, padding: "12px 14px" }}>
              <div className="qs-ed">
                <input className="inp" aria-label="שם הנושא" value={t.t} onChange={e => editTopic(ti, x => { x.t = e.target.value; })} />
                <select className="inp sm" style={{ width: "auto" }} value={t.prog} aria-label="מוצג בתוכנית"
                  onChange={e => editTopic(ti, x => { x.prog = e.target.value as QaTopic["prog"]; })}>
                  <option value="both">שתי התוכניות</option>
                  <option value="omvoh">{content.programs.omvoh.label} בלבד</option>
                  <option value="ebglyss">{content.programs.ebglyss.label} בלבד</option>
                </select>
                <RowTools i={ti} n={content.qa.length} label="נושא"
                  onMove={dir => update(d => move(d.qa, ti, dir))}
                  onDelete={() => { if (confirm(`למחוק את הנושא "${t.t}" ואת כל ${t.items.length} השאלות שבו?`)) update(d => { d.qa.splice(ti, 1); }); }} />
              </div>
              <input className="inp sm" placeholder="שורת מקור (לא חובה)" value={t.src} onChange={e => editTopic(ti, x => { x.src = e.target.value; })} />
            </div>
          ) : <>
            <h2>{t.t}<span className="n">{items.length}</span></h2>
            {t.src && <p className="src">{t.src}</p>}
          </>}

          <div className="qlist">
            {items.map(({ it, ii }) => {
              const isOpen = !!q || open.has(it.id) || editingItem === it.id;
              return (
                <details key={it.id} className="qi" open={isOpen}>
                  <summary onClick={e => { e.preventDefault(); toggle(it.id, !open.has(it.id)); }}>
                    <span className="qq">{it.q || "שאלה ללא כותרת"}</span>
                    {isNew(it, newDays, now) && <span className="qnew">חדש</span>}
                    {editing && (
                      <span className="qi-tools" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
                        <button type="button" className="ib" title="עריכה" aria-label="עריכת השאלה"
                          onClick={e => { e.preventDefault(); setEditingItem(editingItem === it.id ? null : it.id); }}><Icon.pen /></button>
                        <RowTools i={ii} n={t.items.length} label="שאלה"
                          onMove={dir => editTopic(ti, x => move(x.items, ii, dir))}
                          onDelete={() => { if (confirm(`למחוק את השאלה "${it.q}"?`)) editTopic(ti, x => { x.items.splice(ii, 1); }); }} />
                      </span>
                    )}
                    <Icon.chevD />
                  </summary>
                  {editingItem === it.id
                    ? <ItemEditor it={it} content={content} now={now} edit={fn => editTopic(ti, x => fn(x.items[ii]))} onDone={() => { setEditingItem(null); toggle(it.id, true); }} />
                    : <div className="qa-a"><Blocks blocks={it.blocks} content={content} /></div>}
                </details>
              );
            })}
          </div>
          {editing && (
            <button type="button" className="add" style={{ marginTop: 8 }} onClick={() => {
              const nit: QaItem = { id: newId(), q: "שאלה חדשה", blocks: [{ type: "p", text: "" }], addedAt: new Date().toISOString() };
              editTopic(ti, x => { x.items.push(nit); });
              setEditingItem(nit.id);
            }}><Icon.plus />שאלה חדשה בנושא</button>
          )}
        </section>
      ))}

      {editing && (
        <button type="button" className="add" style={{ marginTop: 22 }} onClick={() => update(d => {
          d.qa.push({ id: newId(), t: "נושא חדש", prog: "both", src: "", items: [] });
        })}><Icon.plus />נושא חדש</button>
      )}
    </>
  );
}

function Blocks({ blocks, content }: { blocks: QaBlock[]; content: PspContent }) {
  return <>{blocks.map((b, i) => {
    switch (b.type) {
      case "p": return <p key={i} dangerouslySetInnerHTML={{ __html: rich(b.text) }} />;
      case "note": return <div key={i} className="qn" dangerouslySetInnerHTML={{ __html: rich(b.text) }} />;
      case "alert": return <div key={i} className="qalert" role="note" dangerouslySetInnerHTML={{ __html: rich(b.text) }} />;
      case "ul": return <ul key={i}><ListItems items={b.items} /></ul>;
      case "ol": return <ol key={i}><ListItems items={b.items} /></ol>;
      case "table": return (
        <div key={i} className="qtw"><table className="qt">
          <thead><tr>{b.head.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>
          <tbody>{b.rows.filter(r => r.some(c => c.trim())).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} dangerouslySetInnerHTML={{ __html: rich(c) }} />)}</tr>)}</tbody>
        </table></div>
      );
      case "copy": return <CopyBlock key={i} title={b.title} text={b.text} />;
      case "sms": {
        const t = content.sms[b.key];
        return t ? <CopyBlock key={i} title={b.title || t.t} text={t.body} /> : null;
      }
    }
  })}</>;
}

/** Items starting with "- " nest under the item above them (rendered with hollow "o" bullets). */
function ListItems({ items }: { items: string[] }) {
  const groups: { text: string; subs: string[] }[] = [];
  for (const raw of items) {
    if (!raw.trim()) continue;
    const sub = /^\s*-\s+/.exec(raw);
    if (sub && groups.length) groups[groups.length - 1].subs.push(raw.slice(sub[0].length));
    else groups.push({ text: sub ? raw.slice(sub[0].length) : raw, subs: [] });
  }
  return <>{groups.map((g, j) => (
    <li key={j}>
      <span dangerouslySetInnerHTML={{ __html: rich(g.text) }} />
      {g.subs.length > 0 && <ul className="sub">{g.subs.map((x, k) => <li key={k} dangerouslySetInnerHTML={{ __html: rich(x) }} />)}</ul>}
    </li>
  ))}</>;
}

const BLOCK_LABEL: Record<QaBlock["type"], string> = {
  p: "פסקה", ul: "רשימה", ol: "רשימה ממוספרת", note: "הערה מודגשת", alert: "התראה באדום", table: "טבלה", copy: "טקסט להעתקה", sms: "נוסח SMS",
};

function newBlock(type: QaBlock["type"], content: PspContent): QaBlock {
  switch (type) {
    case "p": case "note": case "alert": return { type, text: "" };
    case "ul": case "ol": return { type, items: [""] };
    case "table": return { type, head: ["", ""], rows: [["", ""]] };
    case "copy": return { type, title: "מה אומרים", text: "" };
    case "sms": return { type, title: "", key: Object.keys(content.sms)[0] ?? "" };
  }
}

const SEP = " | ";
const splitRow = (line: string) => line.split("|").map(s => s.trim());

function ItemEditor({ it, content, now, edit, onDone }: {
  it: QaItem; content: PspContent; now: number; edit: (fn: (it: QaItem) => void) => void; onDone: () => void;
}) {
  const days = content.settings.qaNewDays;
  const showing = isNew(it, days, now);
  const daysLeft = showing ? Math.max(1, Math.ceil((days * DAY_MS - (now - new Date(it.addedAt!).getTime())) / DAY_MS)) : 0;
  const eb = (bi: number, fn: (b: QaBlock) => void) => edit(x => fn(x.blocks[bi]));
  return (
    <div className="qi-edit">
      <label className="fld" style={{ marginTop: 10 }}><span>השאלה</span>
        <input className="inp" value={it.q} onChange={e => edit(x => { x.q = e.target.value; })} />
      </label>
      <div className="qnew-row">
        {showing
          ? <><span className="qnew">חדש</span><span>התווית תוצג עוד כ-{daysLeft} ימים</span>
              <button type="button" className="btn" onClick={() => edit(x => { delete x.addedAt; })}>הסר את התווית עכשיו</button></>
          : <><span>{days > 0 ? "לשאלה אין תווית \"חדש\"" : "תווית \"חדש\" כבויה בהגדרות"}</span>
              {days > 0 && <button type="button" className="btn" onClick={() => edit(x => { x.addedAt = new Date().toISOString(); })}>סמן כ"חדש"</button>}</>}
      </div>
      <FormatHint />
      {it.blocks.map((b, bi) => (
        <div key={bi} className="blk">
          <div className="blk-hd">
            <span>{BLOCK_LABEL[b.type]}</span>
            <RowTools i={bi} n={it.blocks.length} label="בלוק"
              onMove={dir => edit(x => move(x.blocks, bi, dir))}
              onDelete={() => edit(x => { x.blocks.splice(bi, 1); })} />
          </div>
          <div className="blk-bd">
            {(b.type === "p" || b.type === "note" || b.type === "alert") && (
              <textarea className="inp" rows={3} value={b.text} onChange={e => eb(bi, x => { (x as typeof b).text = e.target.value; })} />
            )}
            {(b.type === "ul" || b.type === "ol") && <>
              <textarea className="inp" rows={Math.max(3, b.items.length + 1)} value={b.items.join("\n")}
                onChange={e => eb(bi, x => { (x as typeof b).items = e.target.value.split("\n"); })} />
              <p className="hint" style={{ margin: "4px 0 0" }}>כל שורה = פריט ברשימה. שורה שמתחילה ב-<code>- </code> = תת-פריט של השורה שמעליה.</p>
            </>}
            {b.type === "table" && <>
              <input className="inp sm" placeholder="כותרות העמודות, מופרדות ב- |" value={b.head.join(SEP)}
                onChange={e => eb(bi, x => { (x as typeof b).head = splitRow(e.target.value); })} />
              <textarea className="inp" rows={Math.max(3, b.rows.length + 1)} value={b.rows.map(r => r.join(SEP)).join("\n")}
                onChange={e => eb(bi, x => { (x as typeof b).rows = e.target.value.split("\n").map(splitRow); })} />
              <p className="hint" style={{ margin: "4px 0 0" }}>כל שורה = שורה בטבלה. תאים מפרידים עם <code>|</code>.</p>
            </>}
            {b.type === "copy" && <>
              <input className="inp sm" placeholder="כותרת" value={b.title} onChange={e => eb(bi, x => { (x as typeof b).title = e.target.value; })} />
              <textarea className="inp" rows={4} value={b.text} onChange={e => eb(bi, x => { (x as typeof b).text = e.target.value; })} />
            </>}
            {b.type === "sms" && <>
              <input className="inp sm" placeholder="כותרת (ברירת מחדל: שם הנוסח)" value={b.title} onChange={e => eb(bi, x => { (x as typeof b).title = e.target.value; })} />
              <select className="inp sm" value={b.key} onChange={e => eb(bi, x => { (x as typeof b).key = e.target.value; })}>
                {Object.entries(content.sms).map(([k, t]) => <option key={k} value={k}>{t.t}</option>)}
              </select>
            </>}
          </div>
        </div>
      ))}
      <div className="blk-add">
        {(Object.keys(BLOCK_LABEL) as QaBlock["type"][]).map(t => (
          <button key={t} type="button" onClick={() => edit(x => { x.blocks.push(newBlock(t, content)); })}>+ {BLOCK_LABEL[t]}</button>
        ))}
      </div>
      <div style={{ marginTop: 12 }}><button type="button" className="btn pri" onClick={onDone}>סיום עריכה</button></div>
    </div>
  );
}
