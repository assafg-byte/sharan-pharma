import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import SessionWrapper from "@/components/SessionWrapper";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin", "hebrew"],
});

// Link preview (WhatsApp etc.): needs absolute URLs, hence metadataBase.
// Set SITE_URL to the public address when the site moves to its own domain.
const SITE_TITLE = "חטיבת פארמה שרן";
const SITE_DESCRIPTION = "שרן — רפואה עד הבית";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://scheduler-tau-pink.vercel.app"),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_TITLE,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "he_IL",
    images: [{ url: "/og-home.png", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  icons: [
    { rel: "icon", url: "/favicon.png", type: "image/png" },
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className={`min-h-full flex flex-col font-[family-name:var(--font-rubik)]`}>
        <SessionWrapper>{children}</SessionWrapper>
      </body>
    </html>
  );
}
