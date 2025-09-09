// app/layout.tsx
// @ts-nocheck
import "./globals.css";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import { cookies } from "next/headers";
import { KEYS, LEGACY_KEYS } from "@/lib/brand";

function getLang(): "en" | "hi" {
  // Read new cookie first, then legacy; default English
  const ck =
    cookies().get(KEYS.langCookie)?.value?.toLowerCase() ||
    cookies().get(LEGACY_KEYS.langCookie)?.value?.toLowerCase() ||
    "en";
  return ck === "hi" ? "hi" : "en";
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const lang = getLang();
  return (
    <html lang={lang} data-lang={lang}>
      <head>
        {/* Global fallback OG image */}
        <meta property="og:image" content="/og/default.png" />
        <meta name="twitter:card" content="summary_large_image" />
      </head>
      <body className="bg-white text-gray-900">
        {children}
        <Footer />
      </body>
    </html>
  );
}
