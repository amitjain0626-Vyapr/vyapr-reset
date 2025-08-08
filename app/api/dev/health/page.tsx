// @ts-nocheck
"use client";

import { useEffect, useState } from "react";

type Result = {
  ok: boolean;
  env: Record<string, boolean | string>;
  tables: Array<{
    table: string;
    hasTable: boolean;
    missingColumns: string[];
    rlsEnabled: boolean;
    count: number | null;
    errors: { columns: string | null; count: string | null };
  }>;
  policies: Record<string, string[]>;
  buckets: Array<{ bucket: string; exists: boolean; public: boolean; error: string | null }>;
  timestamp: string;
};

export default function DevHealthPage() {
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dev/diag", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed");
        setData(json);
      } catch (e: any) {
        setErr(e?.message || "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <main className="max-w-4xl mx-auto px-4 py-10">Checking…</main>;
  if (err) return <main className="max-w-4xl mx-auto px-4 py-10">✗ {err}</main>;
  if (!data) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold">Dev Health</h1>
      <div className={`p-3 rounded-xl border ${data.ok ? "border-green-400" : "border-red-400"}`}>
        Overall: <b>{data.ok ? "OK" : "Needs attention"}</b> • {new Date(data.timestamp).toLocaleString()}
      </div>

      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-medium mb-2">Environment</h2>
        <ul className="text-sm grid md:grid-cols-2 gap-y-1">
          {Object.entries(data.env).map(([k, v]) => (
            <li key={k}>
              <b>{k}</b>: {String(v)}
            </li>
          ))}
        </ul>
      </section>

      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-medium mb-2">Tables</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {data.tables.map((t) => (
            <div key={t.table} className="border rounded-xl p-3 text-sm">
              <div className="font-medium mb-1">{t.table}</div>
              <div>exists: <b>{String(t.hasTable)}</b></div>
              <div>rlsEnabled: <b>{String(t.rlsEnabled)}</b></div>
              <div>rows: <b>{t.count === null ? "?" : t.count}</b></div>
              {t.missingColumns.length ? (
                <div className="mt-2 text-red-600">
                  Missing: {t.missingColumns.join(", ")}
                </div>
              ) : (
                <div className="mt-2 text-green-700">All required columns present</div>
              )}
              {(t.errors.columns || t.errors.count) && (
                <div className="mt-2 text-xs opacity-70">
                  {t.errors.columns ? `columnsErr: ${t.errors.columns}` : null}
                  {t.errors.count ? ` • countErr: ${t.errors.count}` : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-medium mb-2">Policies & Buckets</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-3 text-sm">
            <div className="font-medium mb-2">Policies</div>
            {Object.entries(data.policies).map(([tbl, names]) => (
              <div key={tbl} className="mb-2">
                <div className="font-semibold">{tbl}</div>
                <div className="text-xs">{names.length ? names.join(", ") : "—"}</div>
              </div>
            ))}
          </div>
          <div className="border rounded-xl p-3 text-sm">
            <div className="font-medium mb-2">Buckets</div>
            {data.buckets.map((b) => (
              <div key={b.bucket}>
                {b.bucket}: exists=<b>{String(b.exists)}</b>, public=<b>{String(b.public)}</b>
                {b.error ? <span className="text-xs opacity-70"> • {b.error}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="text-sm opacity-70">
        <div>Helpful links:</div>
        <ul className="list-disc ml-5">
          <li><a className="underline" href="/dashboard">Dashboard</a></li>
          <li><a className="underline" href="/dashboard/leads">Leads</a></li>
          <li><a className="underline" href="/dashboard/payments">Payments</a></li>
          <li><a className="underline" href="/onboarding">Onboarding</a></li>
          <li><a className="underline" href="/">Home</a></li>
        </ul>
      </section>
    </main>
  );
}
