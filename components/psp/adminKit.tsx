"use client";

/**
 * Admin building blocks shared by the PSP page and the Nucala script:
 * the admin-password dialog, the save-version dialog and small helpers.
 * The admin session (cookie) is the same for both — see lib/psp/editAuth.ts.
 */
import { useEffect, useState } from "react";
import { Icon } from "./icons";

export const NAME_KEY = "psp-editor-name";

export function localStorageGet(k: string) { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } }
export function localStorageSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div className="ovl" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mdl plain" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function LoginDialog({ onClose, onOk }: { onClose: () => void; onOk: () => void }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/psp/auth", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (r.ok) return onOk();
    setErr(r.status === 503 ? "סיסמת האדמין לא הוגדרה בשרת (PSP_EDIT_PASSWORD)." : "סיסמה שגויה.");
  };
  return (
    <Dialog title="כניסת אדמין" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="fld"><span>סיסמת אדמין</span>
          <span className="pw">
            <input className="inp" type={show ? "text" : "password"} autoFocus value={pw} dir="ltr"
              autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e => setPw(e.target.value)} />
            <button type="button" className="ib" onClick={() => setShow(v => !v)}
              aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"} title={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}>
              {show ? <Icon.eyeOff /> : <Icon.eye />}
            </button>
          </span>
        </label>
        <p className="err">{err}</p>
        <div className="row2">
          <button type="button" className="sec" onClick={onClose}>ביטול</button>
          <button type="submit" disabled={busy || !pw}>{busy ? "בודק…" : "כניסה"}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function SaveDialog({ onClose, onSave, placeholder = "למשל: עדכון נוסח SMS שבוע 9" }: {
  onClose: () => void; onSave: (editor: string, note: string) => Promise<string | null>; placeholder?: string;
}) {
  const [editor, setEditor] = useState(() => localStorageGet(NAME_KEY));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await onSave(editor.trim(), note.trim());
    setBusy(false);
    if (res) setErr(res);
  };
  return (
    <Dialog title="שמירת גרסה חדשה" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="fld"><span>השם שלך</span>
          <input className="inp" autoFocus={!editor} value={editor} onChange={e => setEditor(e.target.value)} required />
        </label>
        <label className="fld"><span>מה שונה? (לא חובה)</span>
          <input className="inp" autoFocus={!!editor} value={note} placeholder={placeholder} onChange={e => setNote(e.target.value)} />
        </label>
        <p className="err">{err}</p>
        <div className="row2">
          <button type="button" className="sec" onClick={onClose}>ביטול</button>
          <button type="submit" disabled={busy || !editor.trim()}>{busy ? "שומר…" : "שמירה"}</button>
        </div>
      </form>
    </Dialog>
  );
}
