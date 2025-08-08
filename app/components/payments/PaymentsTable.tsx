"use client";
// @ts-nocheck
import { useState } from "react";

export default function PaymentsTable({ initialRows = [] }: { initialRows: any[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const markPaid = async (id: string) => {
    setBusyId(id);
    setErr(null);
    try {
      const res = await fetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setRows((r: any[]) => r.map((x) => (x.id === id ? { ...x, status: "paid" } : x)));
    } catch (e: any) {
      setErr(e?.message || "Something went wrong");
    } finally {
      setBusyId(null);
    }
  };

  if (!rows?.length) {
    return <p className="text-sm">No payments yet. Use “Create Mock Order” on Dashboard.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-3">When</th>
            <th className="text-left p-3">Order</th>
            <th className="text-left p-3">Amount</th>
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p: any) => (
            <tr key={p.id} className="border-t">
              <td className="p-3 whitespace-nowrap">
                {new Date(p.created_at).toLocaleString()}
              </td>
              <td className="p-3">
                <div>{p.provider?.toUpperCase()} • {p.provider_order_id}</div>
                {p.receipt ? <div className="text-xs opacity-70">Receipt: {p.receipt}</div> : null}
              </td>
              <td className="p-3">
                ₹{(p.amount / 100).toFixed(2)} {p.currency || "INR"}
              </td>
              <td className="p-3">
                <span className="inline-block px-2 py-1 rounded-lg border">
                  {p.status}
                </span>
              </td>
              <td className="p-3">
                <button
                  className="px-3 py-1 rounded-lg border"
                  disabled={busyId === p.id || p.status === "paid"}
                  onClick={() => markPaid(p.id)}
                >
                  {busyId === p.id ? "Updating…" : p.status === "paid" ? "Paid" : "Mark Paid"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <div className="p-3 text-sm text-red-600">✗ {err}</div>}
    </div>
  );
}
