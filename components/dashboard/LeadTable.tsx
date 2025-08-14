// components/dashboard/LeadTable.tsx
// Search, filters, unread badge, client-side sorting.
// Safe telemetry hook on mount.
// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";

type Lead = {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  source: "WhatsApp" | "Instagram" | "Microsite" | "Referral";
  status: "New" | "In Progress" | "Won" | "Lost";
  unread?: boolean;
  note?: string;
  value?: number;
};

const STATUS = ["All", "New", "In Progress", "Won", "Lost"] as const;
const SOURCE = ["All", "WhatsApp", "Instagram", "Microsite", "Referral"] as const;

export default function LeadTable({
  slug,
  sessionId,
  initialLeads,
}: {
  slug: string;
  sessionId: string;
  initialLeads: Lead[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS)[number]>("All");
  const [source, setSource] = useState<(typeof SOURCE)[number]>("All");
  const [sortBy, setSortBy] = useState<"newest" | "value">("newest");

  // Telemetry — fires once on mount (safe no-op if window.vyapr undefined)
  useEffect(() => {
    try {
      (window as any)?.vyapr?.track?.("dashboard_view", {
        slug,
        sessionId,
        ts: Date.now(),
      });
    } catch {}
  }, [slug, sessionId]);

  const unreadCount = useMemo(
    () => (initialLeads ?? []).filter((l) => l.unread).length,
    [initialLeads]
  );

  const filtered = useMemo(() => {
    let rows = [...(initialLeads ?? [])];

    if (q.trim()) {
      const s = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.phone.toLowerCase().includes(s) ||
          r.note?.toLowerCase().includes(s)
      );
    }
    if (status !== "All") rows = rows.filter((r) => r.status === status);
    if (source !== "All") rows = rows.filter((r) => r.source === source);

    if (sortBy === "newest") {
      rows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortBy === "value") {
      rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    }

    return rows;
  }, [initialLeads, q, status, source, sortBy]);

  return (
    <div className="p-4">
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, note…"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-10 text-sm outline-none focus:border-teal-500"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              ⌕
            </span>
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-teal-500"
          >
            {STATUS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Statuses" : s}
              </option>
            ))}
          </select>

          <select
            value={source}
            onChange={(e) => setSource(e.target.value as any)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-teal-500"
          >
            {SOURCE.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Sources" : s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-teal-50 px-2 py-1 text-xs text-teal-700">
            Unread: {unreadCount}
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-teal-500"
          >
            <option value="newest">Sort: Newest</option>
            <option value="value">Sort: Value</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">Lead</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Value</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {lead.unread ? (
                      <span
                        aria-label="unread"
                        title="unread"
                        className="inline-block h-2 w-2 rounded-full bg-teal-500"
                      />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-transparent" />
                    )}
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {lead.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {lead.phone}
                        {lead.note ? " • " + lead.note : ""}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{lead.source}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      "rounded-full px-2 py-1 text-xs " +
                      (lead.status === "New"
                        ? "bg-blue-50 text-blue-700"
                        : lead.status === "In Progress"
                        ? "bg-amber-50 text-amber-700"
                        : lead.status === "Won"
                        ? "bg-teal-50 text-teal-700"
                        : "bg-gray-100 text-gray-600")
                    }
                  >
                    {lead.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {lead.value
                    ? `₹${lead.value.toLocaleString("en-IN")}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {new Date(lead.created_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={`/inbox?slug=${encodeURIComponent(slug)}&lead=${encodeURIComponent(
                      lead.id
                    )}`}
                    className="rounded-xl border border-gray-200 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Open
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Total: {filtered.length} leads</span>
        <span>
          Tip: Use the search box to find notes like “weekend slot” or a phone.
        </span>
      </div>
    </div>
  );
}
