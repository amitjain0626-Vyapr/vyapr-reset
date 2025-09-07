// components/dashboard/PayInPersonToggle.tsx
// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

async function getProviderId(slug?: string | null) {
  if (!slug) return null;
  try {
    const res = await fetch(`/api/cron/nudges?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    return j?.provider_id || null;
  } catch {
    return null;
  }
}

async function readToggle(provider_id: string | null) {
  try {
    const res = await fetch(`/api/debug/events?event=provider.pay_in_person.toggled&limit=100`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    const rows = Array.isArray(j?.rows) ? j.rows : [];
    const latest = rows
      .filter((r: any) => (provider_id ? String(r?.provider_id) === String(provider_id) : true))
      .sort((a: any, b: any) => (b?.ts || 0) - (a?.ts || 0))[0];
    if (latest && typeof latest.source === "object") {
      return !!latest.source.enabled;
    }
  } catch {}
  // Default ON (allow “Pay in person” if no setting)
  return true;
}

async function writeToggle(slug: string, enabled: boolean) {
  try {
    const res = await fetch(`/api/events/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "provider.pay_in_person.toggled",
        provider_slug: slug,
        source: { enabled },
        ts: Date.now(),
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok !== true) throw new Error(j?.error || "toggle_failed");
    return true;
  } catch {
    return false;
  }
}

export default function PayInPersonToggle({ slug }: { slug: string }) {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pid = await getProviderId(slug);
      if (mounted) setProviderId(pid);
      const on = await readToggle(pid);
      if (mounted) {
        setEnabled(on);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  const onChange = async () => {
    if (saving) return;
    setSaving(true);
    const next = !enabled;
    const ok = await writeToggle(slug, next);
    setSaving(false);
    if (ok) {
      setEnabled(next);
      toast.success(next ? "Pay in person enabled" : "Pay in person disabled");
    } else {
      toast.error("Could not save setting, try again");
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <div className="text-sm font-medium">Allow “Pay in person”</div>
        <div className="text-xs text-gray-500">
          When disabled, customers will only see the UPI option on the Pay page.
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={loading || saving}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          enabled ? "bg-emerald-600" : "bg-gray-300",
          (loading || saving) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
        ].join(" ")}
        aria-pressed={enabled}
        aria-label="Toggle Pay in person"
        title={enabled ? "Currently enabled" : "Currently disabled"}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1"
          ].join(" ")}
        />
      </button>
    </div>
  );
}
