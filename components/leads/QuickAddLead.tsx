"use client";
// @ts-nocheck
import * as React from "react";
import { useRouter } from "next/navigation";

function sanitizePhone(raw?: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "+91" + digits;
  if (digits.startsWith("91")) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 11) return "+91" + digits.slice(1);
  return (digits.startsWith("+") ? "" : "+") + digits;
}

export default function QuickAddLead({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const reset = () => {
    setName("");
    setPhone("");
    setNote("");
    setErr(null);
    setOk(null);
  };

  const submit = async () => {
    setErr(null);
    setOk(null);
    if (!name.trim()) {
      setErr("Please enter the patient's name.");
      return;
    }
    const phoneNorm = sanitizePhone(phone);
    setLoading(true);
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patient_name: name.trim(),
          phone: phoneNorm || null,
          note: note?.trim() || null,
          source: { utm: { source: "dashboard", medium: "quick-add" } },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "lead_create_failed");
      }
      setOk("Lead added.");
      reset();
      setOpen(false);
      // Refresh server-rendered list
      router.refresh();
    } catch (e: any) {
      setErr(String(e?.message || e) || "Failed to add lead.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="px-3 py-2 border rounded text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        + Quick Add
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[320px] rounded-xl border bg-white shadow p-3 z-10">
          <div className="text-sm font-medium mb-2">Add lead</div>

          <label className="block text-xs mb-1">Patient name *</label>
          <input
            className="w-full border rounded px-2 py-1.5 mb-2 text-sm"
            placeholder="e.g., Riya Sharma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="block text-xs mb-1">Phone (India)</label>
          <input
            className="w-full border rounded px-2 py-1.5 mb-2 text-sm"
            placeholder="e.g., 98XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <label className="block text-xs mb-1">Note</label>
          <textarea
            className="w-full border rounded px-2 py-1.5 mb-2 text-sm"
            placeholder="Any context…"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {err ? <div className="text-xs text-red-600 mb-2">{err}</div> : null}
          {ok ? <div className="text-xs text-green-600 mb-2">{ok}</div> : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-3 py-1.5 text-sm border rounded"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm border rounded ${loading ? "opacity-60" : ""}`}
              onClick={submit}
              disabled={loading}
            >
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
