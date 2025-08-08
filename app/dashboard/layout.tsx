// app/dashboard/layout.tsx
// @ts-nocheck
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-lg font-semibold">Vyapr • Dashboard</h1>
        <form action="/auth/signout" method="POST">
          <button className="rounded-xl border px-3 py-2 text-sm font-medium">
            Sign out
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  )
}
