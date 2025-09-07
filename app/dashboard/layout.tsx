// app/dashboard/layout.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import DashboardTabs from "@/components/dashboard/DashboardTabs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
            <DashboardTabs />
          </Suspense>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4">{children}</div>
    </div>
  );
}
