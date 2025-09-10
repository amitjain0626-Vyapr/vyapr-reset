// @ts-nocheck
import React from "react";

// Next.js 15: params is a Promise
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Optional: fetch provider for nicer heading + WA fallback later
  const base = process.env.NEXT_PUBLIC_BASE_URL || "";
  let provider: any = null;
  try {
    if (base) {
      const r = await fetch(`${base}/api/providers/${slug}?now=${Date.now()}`, { cache: "no-store" });
      if (r.ok) {
        const j = await r.json();
        provider = j?.provider || null;
      }
    }
  } catch {
    // fail-open: ignore provider fetch errors
  }

  const title = provider?.display_name ? `Request booking — ${provider.display_name}` : "Request booking";
  const waPhone = (provider?.whatsapp || provider?.phone || "").replace(/[^0-9+]/g, "");
  const waPrefill = encodeURIComponent(
    `Hi${provider?.display_name ? " " + provider.display_name : ""}, I’d like to book a slot.`
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-semibold mb-2">{title}</h1>
      <p className="text-sm text-gray-500 mb-6">
        Fill your details and we’ll notify the provider instantly.
      </p>

      <div id="Korekko-toast" className="hidden mb-4 rounded-lg border px-3 py-2 text-sm"></div>

      <form id="leadForm" className="space-y-4 rounded-2xl border p-4 shadow-sm">
        <input type="hidden" name="slug" value={slug} />
        <div>
          <label className="block text-sm mb-1">Your name</label>
          <input
            name="patient_name"
            placeholder="e.g., Riya Sharma"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Phone (WhatsApp preferred)</label>
          <input
            name="phone"
            placeholder="+91XXXXXXXXXX"
            inputMode="tel"
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Note (optional)</label>
          <textarea
            name="note"
            placeholder="Preferred date/time, service, any details…"
            rows={4}
            className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 active:scale-[.99]"
        >
          Send request
        </button>

        <p className="text-xs text-gray-500 text-center">
          By submitting, you agree to be contacted about this booking.
        </p>
      </form>

      <div id="thankyou" className="hidden mt-6 rounded-2xl border p-4 text-center">
        <h2 className="text-xl font-semibold mb-2">Request sent ✅</h2>
        <p className="text-sm text-gray-600 mb-4">
          We’ve saved your request. You’ll be contacted soon. Meanwhile, you can also ping on WhatsApp.
        </p>
        <a
          id="waLink"
          href={waPhone ? `https://wa.me/${waPhone.replace(/^\+/, "")}?text=${waPrefill}` : "#"}
          className="inline-block rounded-xl border px-4 py-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open WhatsApp
        </a>
      </div>

      {/* tiny inline script to POST via fetch and fail-open with toasts */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  const form = document.getElementById('leadForm');
  const toast = document.getElementById('Korekko-toast');
  const ty = document.getElementById('thankyou');
  const wa = document.getElementById('waLink');

  function showToast(msg, ok){
    toast.textContent = msg;
    toast.className = 'mb-4 rounded-lg border px-3 py-2 text-sm ' + (ok ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-800');
    toast.style.display = 'block';
  }

  if(form){
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const data = new FormData(form);
      const payload = {
        slug: data.get('slug'),
        patient_name: (data.get('patient_name') || '').toString().trim(),
        phone: (data.get('phone') || '').toString().trim(),
        note: (data.get('note') || '').toString().trim(),
        source: {
          path: location.pathname,
          utm: Object.fromEntries(new URLSearchParams(location.search))
        }
      };

      try {
        const res = await fetch('/api/leads/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        const j = await res.json().catch(() => ({}));
        if (res.ok && (j.ok === true || j.id || j.lead_id)) {
          // success → show thank-you block
          form.style.display = 'none';
          ty.style.display = 'block';
          showToast('Saved. We’ve notified the provider.', true);

          // If API returns a specific WhatsApp deep link, prefer it
          if (j.whatsapp_url && wa) {
            wa.href = j.whatsapp_url;
          }
        } else {
          // fail-open: show error toast but keep the page usable
          const err = j?.error || j?.message || 'Could not save. Please try WhatsApp.';
          showToast(err, false);
        }
      } catch (err) {
        showToast('Network issue. Please try again or use WhatsApp.', false);
      }
    });
  }
})();
          `,
        }}
      />
    </div>
  );
}
