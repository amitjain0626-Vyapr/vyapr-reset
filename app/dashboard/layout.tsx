// app/dashboard/layout.tsx
// @ts-nocheck

import React from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">Vyapr • Dashboard</h1>
        <form action="/auth/signout" method="POST">
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>

      <main className="p-4">{children}</main>
    </div>
  );
}
