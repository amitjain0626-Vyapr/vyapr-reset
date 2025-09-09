// app/help/calendar/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
import { BRAND } from "@/lib/brand";

export default function CalendarHelpPage() {
  return (
    <main className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Connect Google Calendar</h1>
      <p className="text-sm text-gray-600">
        Linking your Google Calendar lets {BRAND.name} auto-block booked slots and avoid double bookings.
      </p>

      <ol className="list-decimal pl-5 space-y-2 text-sm">
        <li>
          From the dashboard, if you see the yellow banner, click{" "}
          <span className="font-medium">Connect Calendar</span>.
        </li>
        <li>
          Choose <span className="font-medium">Continue with Google</span> and allow access when asked.
        </li>
        <li>Return to the Leads page — the banner should disappear once connected.</li>
      </ol>

      <div className="rounded-xl border p-4 bg-gray-50 text-sm">
        <div className="font-medium mb-1">Troubleshooting</div>
        <ul className="list-disc pl-5 space-y-1">
          <li>If you changed permissions, sign out and sign in with Google again.</li>
          <li>We request minimal scopes to create events and check conflicts.</li>
          <li>
            Test push: open the three-dots menu on a lead and use <em>Add to Calendar</em>.
          </li>
        </ul>
      </div>

      <div className="pt-2">
        <a
          href="/dashboard/leads?slug=amitjain0626"
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-1.5 text-white text-sm"
        >
          ← Back to Leads
        </a>
      </div>
    </main>
  );
}
