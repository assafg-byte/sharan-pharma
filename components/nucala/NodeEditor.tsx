"use client";

import type { NBlock, NChoice, NNode, NucalaContent, Who } from "@/lib/nucala/types";
import { newId } from "@/lib/psp/format";
import { Icon } from "@/components/psp/icons";
import { RowTools, move } from "@/components/psp/ScreenEditor";
import type { NUpdater } from "./NucalaApp";

const NEW_NODE = "__new__";

const BLOCK_LABEL: Record<NBlock["type"], string> = {
  line: "דיבור", p: "פסקה", h: "כותרת משנה", ul: "רשימה", ol: "רשימה ממוספרת", note: "הערה (כתום)",
  warn: "שימו לב (אדום)", checklist: "צ'קליסט", cols: "עמודות", copy: "טקסט להעתקה", form: "טופס פרטי מטופל",
};

function newBlock(type: NBlock["type"]): NBlock {
  switch (type) {
    case "line": return { type, who: "nurse", text: "" };
    case "p": case "h": case "note": case "warn": return { type, text: "" };
    case "ul": case "ol": return { type, items: [""] };
    case "checklist": return { type, title: "חשוב! לוודא מול המטופל:", items: [""] };
    case "cols": return { type, cols: [{ title: "", items: [""] }, { title: "", items: [""] }] };
    case "copy": return { type, title: "טקסט להעתקה", text: "" };
    case "form": return { type };
  }
}

const lines = (v: string) => v.split("\n");

export default function NodeEditor({ content, node, update, onPick }: {
  content: NucalaContent; node: NNode; update: NUpdater; onPick: (id: string) => void;
}) {
  const idx = content.nodes.findIndex(x => x.id === node.id);
  const edit = (fn: (n: NNode) => void) => update(d => { const t = d.nodes.find(x => x.id === node.id); if (t) fn(t); });
  const incoming = content.nodes.filter(x => x.choices.some(c => c.to === node.id));
  const nodeLabel = (x: NNode) => `${x.title}${x.track && x.track !== x.title ? ` · ${x.track}` : ""}`;

  const createNode = (section: string): string => {
    const id = "N_" + newId().toUpperCase();
    update(d => {
      const at = d.nodes.findIndex(x => x.id === node.id);
      d.nodes.splice(at + 1, 0, {
        id, section, track: "מסך חדש", title: "מסך חדש", pct: node.pct, summary: "",
        blocks: [{ type: "line", who: "nurse", text: "" }], choices: [],
      });
    });
    return id;
  };

  const deleteNode = () => {
    if (node.id === content.start) { alert("זה מסך הפתיחה של התסריט ואי אפשר למחוק אותו. אפשר להגדיר מסך פתיחה אחר בלשונית הגדרות."); return; }
    const refs = content.nodes.reduce((a, x) => a + x.choices.filter(c => c.to === node.id).length, 0);
    const msg = refs
      ? `למחוק את המסך "${node.title}"? ${refs} כפתורים מובילים אליו — הם יימחקו גם כן.`
      : `למחוק את המסך "${node.title}"?`;
    if (!confirm(msg)) return;
    update(d => {
      d.nodes = d.nodes.filter(x => x.id !== node.id);
      d.nodes.forEach(x => { x.choices = x.choices.filter(c => c.to !== node.id); });
    });
    onPick(incoming[0]?.id ?? content.start);
  };

  return (
    <aside className="ed" aria-label="עריכת המסך">
      <div className="ed-hd">
        <label htmlFor="n-node">מסך לעריכה</label>
        <select id="n-node" className="inp" value={node.id} onChange={e => onPick(e.target.value)}>
          {content.sections.map(s => {
            const list = content.nodes.filter(x => x.section === s.id);
            return list.length ? (
              <optgroup key={s.id} label={s.name}>
                {list.map(x => <option key={x.id} value={x.id}>{nodeLabel(x)}</option>)}
              </optgroup>
            ) : null;
          })}
          {content.nodes.filter(x => !content.sections.some(s => s.id === x.section)).map(x =>
            <option key={x.id} value={x.id}>{nodeLabel(x)}</option>)}
        </select>
        <div className="ed-tools">
          <button type="button" className="btn" onClick={() => onPick(createNode(node.section))}>+ מסך חדש</button>
          <button type="button" className="btn" onClick={deleteNode}>מחיקת המסך</button>
        </div>
      </div>

      <section className="ed-sec">
        <h3>פרטי המסך {node.id === content.start && <span>· מסך הפתיחה</span>}</h3>
        <label className="fld"><span>כותרת המסך</span>
          <input className="inp" value={node.title} onChange={e => edit(x => { x.title = e.target.value; })} /></label>
        <div className="grid2">
          <label className="fld"><span>שם קצר במסלול</span>
            <input className="inp" value={node.track} onChange={e => edit(x => { x.track = e.target.value; })} /></label>
          <label className="fld"><span>חלק בתסריט</span>
            <select className="inp" value={node.section} onChange={e => edit(x => { x.section = e.target.value; })}>
              {content.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
        </div>
        <label className="fld"><span>התקדמות בשיחה (%)</span>
          <input className="inp num" type="number" min={0} max={100} value={node.pct}
            onChange={e => edit(x => { x.pct = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); })} /></label>
        <label className="fld"><span>משפט לסיכום השיחה (לא חובה)</span>
          <textarea className="inp" rows={2} value={node.summary} placeholder="נוסף לסיכום שמועתק כשהמסך הזה היה חלק מהשיחה"
            onChange={e => edit(x => { x.summary = e.target.value; })} /></label>
        {incoming.length > 0 && (
          <div className="fld"><span>מגיעים למסך הזה מ:</span>
            <div className="ed-chips">{incoming.map(x => <button key={x.id} type="button" onClick={() => onPick(x.id)}>{x.title}</button>)}</div>
          </div>
        )}
        <p className="hint" style={{ margin: 0 }}>מזהה: <code>{node.id}</code> · מסך {idx + 1} מתוך {content.nodes.length}</p>
      </section>

      <section className="ed-sec">
        <h3>תוכן המסך</h3>
        <p className="hint">עיצוב: <code>**טקסט**</code> = <b>מודגש</b> · קישור: <code>[טקסט](https://...)</code></p>
        {node.blocks.map((b, bi) => (
          <div key={bi} className="blk">
            <div className="blk-hd">
              <span>{BLOCK_LABEL[b.type]}</span>
              <RowTools i={bi} n={node.blocks.length} label="בלוק"
                onMove={dir => edit(x => move(x.blocks, bi, dir))}
                onDelete={() => edit(x => { x.blocks.splice(bi, 1); })} />
            </div>
            <div className="blk-bd"><BlockFields b={b} set={fn => edit(x => fn(x.blocks[bi]))} /></div>
          </div>
        ))}
        <div className="blk-add">
          {(Object.keys(BLOCK_LABEL) as NBlock["type"][]).map(t => (
            <button key={t} type="button" onClick={() => edit(x => { x.blocks.push(newBlock(t)); })}>+ {BLOCK_LABEL[t]}</button>
          ))}
        </div>
      </section>

      <section className="ed-sec">
        <h3>כפתורי המשך <span>לאן כל תשובה מובילה</span></h3>
        <label className="chk-inline" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, fontSize: 13.5 }}>
          <input type="checkbox" checked={!!node.cards} onChange={e => edit(x => { x.cards = e.target.checked || undefined; })} />
          להציג ככרטיסים גדולים (כמו במסך בחירת המסלול)
        </label>
        {node.choices.map((c, ci) => (
          <ChoiceEditor key={c.id} c={c} ci={ci} n={node.choices.length} cards={!!node.cards} content={content}
            edit={fn => edit(x => fn(x.choices[ci]))}
            onMove={dir => edit(x => move(x.choices, ci, dir))}
            onDelete={() => edit(x => { x.choices.splice(ci, 1); })}
            onNew={() => { const id = createNode(node.section); edit(x => { x.choices[ci].to = id; }); }}
            onGo={() => onPick(c.to)} />
        ))}
        <button type="button" className="add" onClick={() => edit(x => {
          x.choices.push({ id: newId(), label: "כפתור חדש", to: "" });
        })}><Icon.plus />כפתור חדש</button>
      </section>
    </aside>
  );
}

function ChoiceEditor({ c, ci, n, cards, content, edit, onMove, onDelete, onNew, onGo }: {
  c: NChoice; ci: number; n: number; cards: boolean; content: NucalaContent;
  edit: (fn: (c: NChoice) => void) => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onNew: () => void; onGo: () => void;
}) {
  const target = content.nodes.find(x => x.id === c.to);
  return (
    <div className="ans-ed">
      <div className="ed-row" style={{ marginBottom: 6 }}>
        <input className="inp" aria-label="טקסט הכפתור" value={c.label} onChange={e => edit(x => { x.label = e.target.value; })} />
        <RowTools i={ci} n={n} onMove={onMove} onDelete={onDelete} label="כפתור" />
      </div>
      {cards && (
        <input className="inp sm" style={{ marginBottom: 6 }} placeholder="שורת הסבר בכרטיס" value={c.desc ?? ""}
          onChange={e => edit(x => { x.desc = e.target.value || undefined; })} />
      )}
      <div className="ed-row">
        <span className="hint" style={{ margin: 0, flex: "none" }}>מוביל אל</span>
        <select className="inp sm" value={target ? c.to : ""} onChange={e => {
          if (e.target.value === NEW_NODE) onNew(); else edit(x => { x.to = e.target.value; });
        }}>
          <option value="">— לא מחובר —</option>
          {content.sections.map(s => {
            const list = content.nodes.filter(x => x.section === s.id);
            return list.length ? (
              <optgroup key={s.id} label={s.name}>{list.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
            ) : null;
          })}
          <option value={NEW_NODE}>+ מסך חדש…</option>
        </select>
        {target && <button type="button" className="ib" title="מעבר למסך היעד" aria-label="מעבר למסך היעד" onClick={onGo}><Icon.chev /></button>}
      </div>
      {!cards && (
        <label style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 7, fontSize: 13 }}>
          <input type="checkbox" checked={!!c.primary} onChange={e => edit(x => { x.primary = e.target.checked || undefined; })} />
          כפתור ראשי (צבוע)
        </label>
      )}
    </div>
  );
}

function BlockFields({ b, set }: { b: NBlock; set: (fn: (b: NBlock) => void) => void }) {
  switch (b.type) {
    case "line":
      return <>
        <select className="inp sm" value={b.who} onChange={e => set(x => { (x as typeof b).who = e.target.value as Who; })}>
          <option value="nurse">אחות</option><option value="patient">מטופל</option><option value="family">בן משפחה</option>
        </select>
        <textarea className="inp" rows={3} value={b.text} onChange={e => set(x => { (x as typeof b).text = e.target.value; })} />
      </>;
    case "h":
      return <input className="inp" value={b.text} onChange={e => set(x => { (x as typeof b).text = e.target.value; })} />;
    case "p": case "note": case "warn":
      return <textarea className="inp" rows={3} value={b.text} onChange={e => set(x => { (x as typeof b).text = e.target.value; })} />;
    case "ul": case "ol":
      return <>
        <textarea className="inp" rows={Math.max(3, b.items.length + 1)} value={b.items.join("\n")}
          onChange={e => set(x => { (x as typeof b).items = lines(e.target.value); })} />
        {b.type === "ol" && (
          <label className="due" style={{ marginTop: 6 }}><span className="lbl">מתחיל ממספר</span>
            <input className="inp sm num" type="number" min={1} value={b.start ?? 1}
              onChange={e => set(x => { const v = parseInt(e.target.value, 10); (x as typeof b).start = v > 1 ? v : undefined; })} />
          </label>
        )}
        <p className="hint" style={{ margin: "4px 0 0" }}>כל שורה = פריט.</p>
      </>;
    case "checklist":
      return <>
        <input className="inp sm" placeholder="כותרת" value={b.title} onChange={e => set(x => { (x as typeof b).title = e.target.value; })} />
        <textarea className="inp" rows={Math.max(3, b.items.length + 1)} value={b.items.join("\n")}
          onChange={e => set(x => { (x as typeof b).items = lines(e.target.value); })} />
        <p className="hint" style={{ margin: "4px 0 0" }}>כל שורה = פריט לסימון.</p>
      </>;
    case "cols":
      return <>
        {b.cols.map((c, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div className="ed-row">
              <input className="inp sm" placeholder={`כותרת עמודה ${i + 1}`} value={c.title}
                onChange={e => set(x => { (x as typeof b).cols[i].title = e.target.value; })} />
              <button type="button" className="ib del" aria-label="מחיקת עמודה" title="מחיקת עמודה"
                onClick={() => set(x => { (x as typeof b).cols.splice(i, 1); })}><Icon.trash /></button>
            </div>
            <textarea className="inp" rows={Math.max(3, c.items.length + 1)} value={c.items.join("\n")}
              onChange={e => set(x => { (x as typeof b).cols[i].items = lines(e.target.value); })} />
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set(x => { (x as typeof b).cols.push({ title: "", items: [""] }); })}>+ עמודה</button>
      </>;
    case "copy":
      return <>
        <input className="inp sm" placeholder="כותרת" value={b.title} onChange={e => set(x => { (x as typeof b).title = e.target.value; })} />
        <textarea className="inp" rows={4} value={b.text} onChange={e => set(x => { (x as typeof b).text = e.target.value; })} />
      </>;
    case "form":
      return <p className="hint" style={{ margin: 0 }}>שדות הטופס נערכים בלשונית &quot;הגדרות&quot;. הערכים מוצגים בתחתית המסך ונכנסים לסיכום השיחה.</p>;
  }
}
