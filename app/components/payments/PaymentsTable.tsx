// @ts-nocheck
"use client";

import { useState } from "react";
import { deletePayment } from "./payments-action";

export default function PaymentsTable({ payments }) {
  const [items, setItems] = useState(payments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    setErrMsg(null);

    const res = await deletePayment(id);
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.id !== id));
    } else {
      if (res.error) {
        setErrMsg(
          typeof res.error === "string"
            ? res.error
            : JSON.stringify(res.error, null, 2)
        );
      } else {
        setErrMsg("Delete failed: Unknown error");
      }
    }

    setLoadingId(null);
  };

  return (
    <div className="space-y-3">
      {errMsg && (
        <div className="text-sm text-red-600 p-2 bg-red-50 rounded whitespace-pre-wrap">
          {errMsg}
        </div>
      )}

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-3 py-2 text-left">ID</th>
            <th className="px-3 py-2 text-left">Amount</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">{p.id}</td>
              <td className="px-3 py-2">₹{p.amount}</td>
              <td className="px-3 py-2">{p.status}</td>
              <td className="px-3 py-2">
                <button
                  onClick={() => handleDelete(p.id)}
                  disabled={loadingId === p.id}
                  className="text-red-600 hover:underline disabled:opacity-60"
                >
                  {loadingId === p.id ? "Deleting..." : "Delete"}
                </button>
              </td>
            </tr>
          ))}

          {items.length === 0 && (
            <tr>
              <td
                colSpan={4}
                className="px-3 py-4 text-center text-gray-500 italic"
              >
                No payments found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
