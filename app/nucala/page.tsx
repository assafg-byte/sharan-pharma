export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Heebo } from "next/font/google";
import NucalaApp from "@/components/nucala/NucalaApp";
import { loadNucala } from "@/lib/nucala/store";
import { EDIT_COOKIE, verifyEditToken } from "@/lib/psp/editAuth";
import "../psp/psp-base.css";
import "../psp/psp-editor.css";
import "./nucala.css";

const heebo = Heebo({ variable: "--font-heebo", subsets: ["latin", "hebrew"] });

export const metadata: Metadata = {
  title: "נוקלה — תסריט שיחה",
  description: "תסריט שיחה אינטראקטיבי לתוכנית התמיכה למטופלי נוקלה (GSK)",
};

export default async function NucalaPage() {
  const [{ content, version }, jar] = await Promise.all([loadNucala(), cookies()]);
  return (
    <div className={heebo.variable}>
      <NucalaApp initialContent={content} initialVersion={version} initialEditing={verifyEditToken(jar.get(EDIT_COOKIE)?.value)} />
    </div>
  );
}
