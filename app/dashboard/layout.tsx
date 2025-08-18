import React from 'react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="font-semibold">Vyapr — Dashboard</div>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/dashboard/leads" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">Leads</Link>
            <Link href="/dashboard/payments" className="rounded-lg border px-3 py-1.5 hover:bg-gray-50">Payments</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
