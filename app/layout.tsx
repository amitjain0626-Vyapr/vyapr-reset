// app/layout.tsx
// @ts-nocheck
import "./globals.css";
import type { ReactNode } from "react";
import Footer from "@/components/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        {children}
        <Footer />
      </body>
    </html>
  );
}
