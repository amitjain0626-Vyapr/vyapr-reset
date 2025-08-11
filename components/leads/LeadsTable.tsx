"use client";

import React from "react";

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
  onRowClick?: (lead: Lead) => void;
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

export default function LeadsTable({ data, onRowClick }: Props) {
  const rows = (data?.length ? data : fallback).slice(0, 50);
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
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => (
            <tr
              key={l.id}
              className="border-t hover:bg-gray-50 cursor-pointer"
              onClick={() => onRowClick?.(l)}
            >
              <td className="p-3">{l.id}</td>
              <td className="p-3">{l.name}</td>
              <td className="p-3">{l.phone ?? "—"}</td>
              <td className="p-3">{l.source ?? "—"}</td>
              <td className="p-3">{l.note ?? "—"}</td>
              <td className="p-3">{formatDate(l.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
