"use client";
// app/dashboard/PaymentsList.tsx
// @ts-nocheck
import { useEffect, useState } from "react";

type Payment = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  note?: string | null;
  order_id?: string | null;
  provider_id?: string | null;
};

export default function PaymentsList({ slug }: { slug?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [rows, setRows]     = useState<Payment[]>([]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = slug ? `/api/payments/orders?slug=${encodeURIComponent(slug)}` : `/api/payments/orders`;
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) throw new Error(json?.error || "Failed to load payments");
        if (!aborted) setRows(json.orders || json.payments || []);
      } catch (e: any) {
        if (!aborted) setError(e?.message || "Error");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [slug]);

  if (loading) return <div className="text-sm text-gray-500">Loading payments…</div>;
  if (error)   return <div className="text-sm text-red-600">Error: {error}</div>;
  if (rows.length === 0) return <div className="text-sm">No payments yet.</div>;

  return (
    <div className="overflow-auto rounded-lg border">
      <table className="min-w-[720px] w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Amount</th>
            <th className="px-3 py-2 text-left">Currency</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Order</th>
            <th className="px-3 py-2 text-left">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">{new Date(p.created_at).toLocaleString("en-IN")}</td>
              <td className="px-3 py-2">{(p.amount / 100).toFixed(2)}</td>
              <td className="px-3 py-2">{p.currency}</td>
              <td className="px-3 py-2">{p.status}</td>
              <td className="px-3 py-2">{p.order_id || "—"}</td>
              <td className="px-3 py-2">{p.note || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
