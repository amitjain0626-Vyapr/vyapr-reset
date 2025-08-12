// app/layout.tsx
// @ts-nocheck
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Vyapr",
  description: "Microsites, bookings, and CRM for solos.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={inter.className + " bg-gray-50 text-gray-900 antialiased"}>
        {children}
      </body>
    </html>
  );
}
