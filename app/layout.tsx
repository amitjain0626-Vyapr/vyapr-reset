// app/layout.tsx
// @ts-nocheck
import "./globals.css";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";
import { cookies } from "next/headers";

function getLang(): "en" | "hi" {
  // Default English for all external-facing content
  const v = cookies().get("vyapr.lang")?.value?.toLowerCase() || "en";
  return v === "hi" ? "hi" : "en";
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
