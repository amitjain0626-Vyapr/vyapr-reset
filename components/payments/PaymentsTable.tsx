"use client";

import React from "react";

type Payment = {
  id: string;
  patient?: string;
  amount: number;
  status: "success" | "pending" | "failed" | string;
  method?: string; // e.g., UPI, Card, Razorpay
  createdAt?: string | Date;
  notes?: string;
};

type Props = {
  data?: Payment[];
  onRefundClick?: (payment: Payment) => void;
};

function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
}

function formatDate(d?: string | Date) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

const badge: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

const fallback: Payment[] = [
  { id: "P-1001", patient: "Kashvi", amount: 1500, status: "success", method: "UPI", createdAt: new Date(), notes: "Cleaning" },
  { id: "P-1002", patient: "Misha", amount: 500, status: "pending", method: "Card", createdAt: new Date(), notes: "Consultation" },
];

export default function PaymentsTable({ data, onRefundClick }: Props) {
  const rows = (data?.length ? data : fallback).slice(0, 50);
  return (
    <div className="w-full overflow-x-auto border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-left">Txn ID</th>
            <th className="p-3 text-left">Patient</th>
            <th className="p-3 text-left">Amount</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Method</th>
            <th className="p-3 text-left">Created</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t hover:bg-gray-50">
              <td className="p-3">{p.id}</td>
              <td className="p-3">{p.patient ?? "—"}</td>
              <td className="p-3">{inr(p.amount)}</td>
              <td className="p-3">
                <span className={`px-2 py-1 rounded-full text-xs ${badge[p.status] ?? "bg-gray-100 text-gray-800"}`}>
                  {p.status}
                </span>
              </td>
              <td className="p-3">{p.method ?? "—"}</td>
              <td className="p-3">{formatDate(p.createdAt)}</td>
              <td className="p-3">
                <button
                  className="px-3 py-1 border rounded-lg hover:bg-gray-100"
                  onClick={() => onRefundClick?.(p)}
                >
                  Refund
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
