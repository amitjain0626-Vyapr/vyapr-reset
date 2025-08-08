"use client";
// @ts-nocheck
import { useState } from "react";

const STATUS = ["new", "contacted", "booked", "closed", "spam"];

export default function LeadsTable({ initialLeads = [] }: { initialLeads: any[] }) {
  const [rows, setRows] = useState(initialLeads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/leads/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setRows((r) => r.map((x: any) => (x.id === id ? { ...x, status } : x)));
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  if (!rows?.length) {
    return <p className="text-sm">No leads yet.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-3">When</th>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Contact</th>
            <th className="text-left p-3">Message</th>
            <th className="text-left p-3">Source</th>
            <th className="text-left p-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead: any) => (
            <tr key={lead.id} className="border-t">
              <td className="p-3 whitespace-nowrap">
                {new Date(lead.created_at).toLocaleString()}
              </td>
              <td className="p-3">{lead.name || "—"}</td>
              <td className="p-3">
                {lead.email ? <div>{lead.email}</div> : null}
                {lead.phone ? <div>{lead.phone}</div> : null}
              </td>
              <td className="p-3 max-w-[28rem]">
                <div className="line-clamp-3">{lead.message || "—"}</div>
              </td>
              <td className="p-3">{lead.source || "—"}</td>
              <td className="p-3">
                <select
                  className="border rounded-lg px-2 py-1"
                  disabled={busyId === lead.id}
                  value={lead.status || "new"}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
                >
                  {STATUS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <div className="p-3 text-sm text-red-600">✗ {err}</div>}
    </div>
  );
}
