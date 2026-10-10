"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

export function copyText(t: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
  return new Promise(res => {
    const a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", "");
    a.style.cssText = "position:fixed;top:-9999px;opacity:0";
    document.body.appendChild(a); a.select();
    try { document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(a); res();
  });
}

function useCopied(text: string): [boolean, (e?: React.MouseEvent) => void] {
  const [ok, setOk] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const copy = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation();
    copyText(text).then(() => {
      setOk(true);
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setOk(false), 1800);
    });
  }, [text]);
  return [ok, copy];
}

const Btn = ({ ok, onClick }: { ok: boolean; onClick: (e: React.MouseEvent) => void }) => (
  <button type="button" className={`copy${ok ? " ok" : ""}`} onClick={onClick}>
    <Icon.copy /><span>{ok ? "הועתק" : "העתק"}</span>
  </button>
);

/** SMS template card — used in the flow screens. */
export function SmsCard({ title, sub, when, body }: { title: string; sub?: string; when?: string; body: string }) {
  const [ok, copy] = useCopied(body);
  return (
    <article className="sms">
      <div className="sms-hd">
        <span className="sms-t">{title}{sub && <em>{sub}</em>}</span>
        {when && <span className="sms-when">{when}</span>}
        <Btn ok={ok} onClick={copy} />
      </div>
      <pre className="sms-b" onClick={copy}>{body}</pre>
    </article>
  );
}

/** Copyable text box — used inside Q&A answers. */
export function CopyBlock({ title, text }: { title: string; text: string }) {
  const [ok, copy] = useCopied(text);
  return (
    <div className="qcp">
      <div className="qcp-hd"><span>{title}</span><Btn ok={ok} onClick={copy} /></div>
      <pre onClick={copy}>{text}</pre>
    </div>
  );
}
