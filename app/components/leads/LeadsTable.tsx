// @ts-nocheck
"use client";

import { useState } from "react";
import { deleteLead } from "./leads-action";

export default function LeadsTable({ leads }) {
  const [items, setItems] = useState(leads);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    setErrMsg(null);

    const res = await deleteLead(id);
    if (res.ok) {
      setItems((prev) => prev.filter((l) => l.id !== id));
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
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Phone</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((l) => (
            <tr key={l.id} className="border-t">
              <td className="px-3 py-2">{l.name}</td>
              <td className="px-3 py-2">{l.phone}</td>
              <td className="px-3 py-2">{l.status}</td>
              <td className="px-3 py-2">
                <button
                  onClick={() => handleDelete(l.id)}
                  disabled={loadingId === l.id}
                  className="text-red-600 hover:underline disabled:opacity-60"
                >
                  {loadingId === l.id ? "Deleting..." : "Delete"}
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
                No leads found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
