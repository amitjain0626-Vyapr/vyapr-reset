// @ts-nocheck
"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function UpiSettingsForm({
  providerId,
  slug,
  initialUpi,
}: {
  providerId: string;
  slug: string;
  initialUpi?: string;
}) {
  const [upi, setUpi] = useState(initialUpi || "");
  const [saving, setSaving] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const v = (upi || "").trim().toLowerCase();
    if (!v.includes("@")) {
      toast.message("Enter a valid UPI ID (e.g., name@bank)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/provider/upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, upi_id: v }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "save_failed");
      toast.success("UPI saved");
    } catch (e: any) {
      toast.error(e?.message || "Could not save UPI");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-2" data-test="upi-form">
      <label className="text-xs text-gray-600">UPI ID</label>
      <input
        className="w-full rounded border px-3 py-2 text-sm font-mono"
        placeholder="drkapoor@oksbi"
        value={upi}
        onChange={(e) => setUpi(e.target.value)}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg px-3 py-1.5 bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-40"
          data-test="upi-save"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <a
          href={`/pay/TEST-LEAD?slug=${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-700 underline text-sm"
          title="Preview your pay page"
        >
          Preview pay page →
        </a>
      </div>
    </form>
  );
}
