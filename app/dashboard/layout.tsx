// app/dashboard/layout.tsx
// @ts-nocheck
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Keep layout dumb — no server-side auth checks here.
  // Client pages call /api/leads/list with cookies included.
  return (
    <div className="min-h-screen">
      <header className="border-b p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="font-semibold">Vyapr — Dashboard</div>
          <nav className="text-sm flex gap-3">
            <a href="/dashboard/leads" className="hover:underline">Leads</a>
            <a href="/dashboard/payments" className="hover:underline">Payments</a>
            <a href="/onboarding" className="hover:underline">Profile</a>
            <a href="/auth/signout" className="hover:underline">Sign out</a>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-6">{children}</main>
    </div>
  );
}
