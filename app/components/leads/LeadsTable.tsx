"use client";

import React, { useState } from "react";

type Lead = {
  id: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt?: string | Date;
  source?: string;
};

type Props = {
  data?: Lead[];
};

function formatDate(d?: string | Date) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

const fallback: Lead[] = [
  { id: "L-001", name: "Niharika", phone: "+91-98xxxxxx", note: "Follow-up", createdAt: new Date(), source: "Microsite" },
  { id: "L-002", name: "Chaitanya", phone: "+91-88xxxxxx", note: "WhatsApp ping", createdAt: new Date(), source: "WhatsApp" },
];

export default function LeadsTable({ data }: Props) {
  const rows = (data?.length ? data : fallback).slice(0, 50);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function onDelete(id: string) {
    try {
      setBusyId(id);
      const res = await fetch("/api/leads/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        console.error(await res.json());
        alert("Delete failed");
      } else {
        // simple reload; SSR page will refetch
        location.reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full overflow-x-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Lead ID</th>
            <th className="p-3 text-left">Name</th>
            <th className="p-3 text-left">Phone</th>
            <th className="p-3 text-left">Source</th>
            <th className="p-3 text-left">Note</th>
            <th className="p-3 text-left">Created</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id} className="border-t hover:bg-gray-50">
              <td className="p-3">{l.id}</td>
              <td className="p-3">{l.name}</td>
              <td className="p-3">{l.phone ?? "—"}</td>
              <td className="p-3">{l.source ?? "—"}</td>
              <td className="p-3">{l.note ?? "—"}</td>
              <td className="p-3">{formatDate(l.createdAt)}</td>
              <td className="p-3">
                <button
                  onClick={() => onDelete(l.id)}
                  disabled={busyId === l.id}
                  className="px-3 py-1 border rounded-lg hover:bg-red-50 disabled:opacity-60"
                  title="Soft delete"
                >
                  {busyId === l.id ? "Deleting…" : "Delete"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
