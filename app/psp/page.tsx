export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Assistant } from "next/font/google";
import PspApp from "@/components/psp/PspApp";
import { loadLatest } from "@/lib/psp/store";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/psp/editAuth";
import "./psp-base.css";
import "./psp-editor.css";

const assistant = Assistant({ variable: "--font-assistant", subsets: ["latin", "hebrew"] });

export const metadata: Metadata = {
  title: "Lilly PSP — תוכניות תמיכה",
  description: "תרשים זרימה ושאלות ותשובות לתוכניות התמיכה Omvoh ו-Ebglyss",
};

export default async function PspPage() {
  const [{ content, version }, jar] = await Promise.all([loadLatest(), cookies()]);
  return (
    <div className={assistant.variable}>
      <PspApp initialContent={content} initialVersion={version} initialEditing={verifyEditToken(jar.get(EDIT_COOKIE)?.value)} />
    </div>
  );
}
