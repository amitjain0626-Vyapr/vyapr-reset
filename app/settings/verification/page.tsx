// app/settings/verification/page.tsx
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = {
  ok: boolean;
  provider_id?: string | null;
  verified?: boolean;
  method?: "none" | "doc_or_admin" | "referral";
  referrals?: number;
  error?: string;
};

const SITE = process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  let j: any = null;
  try { j = await r.json(); } catch {}
  return j as T;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ slug?: string; uploaded?: string }> }) {
  const { slug = "", uploaded = "" } = await searchParams;
  const useSlug = (slug || "").trim();

  const status: Status = useSlug
    ? await getJSON<Status>(`${SITE}/api/verification/status?slug=${encodeURIComponent(useSlug)}`)
    : { ok: false, verified: false, method: "none", referrals: 0 };

  // Load last few uploads (server-side), filter by this provider_id
  let recentUploads: Array<{ ts: number; path: string; doc_type?: string }> = [];
  if (status?.provider_id) {
    try {
      const evt = await getJSON<any>(`${SITE}/api/debug/events?event=provider.doc.uploaded&limit=20`);
      const rows: any[] = Array.isArray(evt?.rows) ? evt.rows : [];
      recentUploads = rows
        .filter((r) => r?.provider_id === status.provider_id)
        .sort((a, b) => (b?.ts || 0) - (a?.ts || 0))
        .slice(0, 5)
        .map((r) => ({ ts: r.ts, path: r?.source?.path, doc_type: r?.source?.doc_type }));
    } catch {}
  }

  return (
    <main className="p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Trust & Verification</h1>
        <p className="text-sm text-gray-600 mt-1">
          {useSlug ? <>Provider: <span className="font-mono">{useSlug}</span></> : <>Tip: open with <span className="font-mono">?slug=&lt;your-slug&gt;</span></>}
        </p>
      </header>

      {/* Success banner after upload */}
      {uploaded === "1" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ Document uploaded successfully. We’ll review and update your verification status soon.
        </div>
      )}

      {/* Current status */}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-semibold mb-2">Current status</h2>
        <div className="text-sm">
          <div>Verified: <span className={status?.verified ? "text-emerald-700" : "text-gray-800"}>{String(status?.verified ?? false)}</span></div>
          <div>Method: <span className="font-mono">{status?.method || "none"}</span></div>
          <div>Referrals: <span className="font-mono">{status?.referrals ?? 0}</span></div>
        </div>
      </section>

      {/* Upload Govt ID */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold mb-3">Upload Govt ID (fastest)</h3>
        <form method="post" action="/api/verification/upload" encType="multipart/form-data" className="space-y-3">
          <input type="hidden" name="slug" value={useSlug} />
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Document type</label>
            <select name="doc_type" className="border rounded px-3 py-2 text-sm" required>
              <option value="">Select</option>
              <option value="aadhaar">Aadhaar</option>
              <option value="pan">PAN</option>
              <option value="voter">Voter ID</option>
              <option value="dl">Driving Licence</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Upload file (jpg, png, pdf)</label>
            <input type="file" name="file" accept=".jpg,.jpeg,.png,.pdf" className="border rounded px-3 py-2 text-sm" required />
          </div>
          <button type="submit" className="rounded-full border px-4 py-2 text-sm hover:shadow-sm bg-emerald-600 text-white">
            Upload & Submit
          </button>
        </form>

        {/* Recent uploads list */}
        {recentUploads.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold mb-2">Recent uploads</div>
            <ul className="space-y-2 text-sm">
              {recentUploads.map((u, i) => {
                const dt = new Date(u.ts || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
                const fileName = (u.path || "").split("/").pop() || u.path;
                const viewHref = `/api/verification/file?path=${encodeURIComponent(u.path || "")}`;
                return (
                  <li key={i} className="flex items-center justify-between gap-2 rounded border px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate"><span className="text-gray-500">Type:</span> {u.doc_type || "unknown"}</div>
                      <div className="truncate"><span className="text-gray-500">File:</span> <span title={u.path}>{fileName}</span></div>
                      <div className="text-xs text-gray-500">{dt} IST</div>
                    </div>
                    <a href={viewHref} target="_blank" rel="noreferrer" className="shrink-0 rounded-full border px-3 py-1 text-xs hover:shadow-sm">View</a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* DigiLocker */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold mb-3">Verify via DigiLocker</h3>
        <form method="post" action="/api/verification/digilocker" className="space-y-3">
          <input type="hidden" name="slug" value={useSlug} />
          <button type="submit" className="rounded-full border px-4 py-2 text-sm hover:shadow-sm bg-blue-600 text-white">
            Connect DigiLocker
          </button>
          <p className="text-xs text-gray-500">One-click verification via DigiLocker (coming soon).</p>
        </form>
      </section>

      {/* Manual form (kept) */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold mb-3">Submit Govt ID (manual review)</h3>
        <form method="post" action="/api/verification/doc" className="space-y-3">
          <input type="hidden" name="slug" value={useSlug} />
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Reference / last 4 (optional)</label>
            <input name="doc_ref" className="border rounded px-3 py-2 text-sm" placeholder="xxxx-xxxx-xxxx" />
            <div className="grid gap-2"> <label className="text-xs text-gray-600">Document type</label> <select name="doc_type" className="border rounded px-3 py-2 text-sm" required> <option value="">Select</option> <option value="aadhaar">Aadhaar</option> <option value="pan">PAN</option> <option value="voter">Voter ID</option> <option value="dl">Driving Licence</option> <option value="other">Other</option> </select> </div> ``` …2 lines after ```tsx <button type="submit" className="rounded-full border px-4 py-2 text-sm hover:shadow-sm">Submit for review</button>
          </div>
          <button type="submit" className="rounded-full border px-4 py-2 text-sm hover:shadow-sm">Submit for review</button>
        </form>
      </section>

      {/* WA Green Tick */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold mb-3">Request WhatsApp Green Tick help</h3>
        <form method="post" action="/api/verification/wa/request" className="space-y-3">
          <input type="hidden" name="slug" value={useSlug} />
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">WhatsApp number (optional)</label>
            <input name="wa_number" className="border rounded px-3 py-2 text-sm" placeholder="+91…" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Brand / Business name (optional)</label>
            <input name="brand_name" className="border rounded px-3 py-2 text-sm" placeholder="Your brand" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs text-gray-600">Note (optional)</label>
            <input name="note" className="border rounded px-3 py-2 text-sm" placeholder="Any extra context" />
          </div>
          <button type="submit" className="rounded-full border px-4 py-2 text-sm hover:shadow-sm">Request help</button>
        </form>
      </section>

      {/* Shortcuts */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="text-sm font-semibold mb-2">Shortcuts</h3>
        <div className="flex flex-wrap gap-3 text-sm">
          <a className="underline" href={`/microsite/${useSlug || ""}`} target="_blank" rel="noreferrer">View microsite</a>
          <a className="underline" href={`/dashboard?slug=${useSlug || ""}`} target="_blank" rel="noreferrer">Back to dashboard</a>
        </div>
      </section>
    </main>
  );
}
