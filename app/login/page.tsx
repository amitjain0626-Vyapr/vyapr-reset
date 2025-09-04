// app/login/page.tsx
// @ts-nocheck
"use client";

import { useMemo, useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SITE =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DEFAULT_PROVIDER_SLUG = "amitjain0626";

function makeSb() {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true },
  });
}

async function logEvent(event: string, source: any = {}) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, source }),
    });
  } catch {}
}

export default function LoginPage() {
  const supabase = useMemo(() => makeSb(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Inline notice for query param errors (e.g., apple_unavailable)
const [notice, setNotice] = useState<string | null>(null);

  // Phone form
  const [phone, setPhone] = useState<string>("");
  const [slug, setSlug] = useState<string>(DEFAULT_PROVIDER_SLUG);
  const [waOk, setWaOk] = useState<boolean | null>(null);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>("");

  const redirectTo = `${SITE}/auth/finish`;
  useEffect(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("e");
    if (e === "apple_unavailable") {
      setNotice("Apple sign-in isn’t set up yet. Please use Google or Phone OTP for now.");
    } else if (e === "finish") {
      setNotice("Couldn’t finalize sign-in. Please try again.");
    } else if (e === "calendar_reconnect") {
      setNotice("To enable Calendar sync, please continue with Google and allow Calendar access.");
    }
  } catch {}
}, []);

  async function signInWith(provider: "google" | "apple") {
    try {
      setErr(null);
      setBusy(provider);

      if (provider === "google") {
        // telemetry: user initiated google oauth
        await logEvent("auth.google.start", {
          via: "supabase",
          scope: "contacts.readonly",
        });
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // Important: scopes + consent to get refresh/grant for contacts.readonly
          scopes:
  provider === "google"
    ? "openid email profile https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/calendar.events"
    : undefined,
          queryParams:
            provider === "google"
              ? { access_type: "offline", prompt: "consent" }
              : {},
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || "auth_failed");
      setBusy(null);
    }
  }

  async function requestWaCheck(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy("wa");
    setWaOk(null);

    try {
      const payload = {
        slug: (slug || "").trim(),
        wa_number: (phone || "").trim(),
        brand_name: "Vyapr",
        note: "login-wa-check",
      };

      const res = await fetch("/api/verification/wa/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "wa_request_failed");

      setWaOk(true);
    } catch (e: any) {
      setWaOk(false);
      setErr(e?.message || "wa_request_failed");
    } finally {
      setBusy(null);
    }
  }

  async function sendOtp() {
    try {
      setErr(null);
      setBusy("send");
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          phone: (phone || "").trim(),
          slug: (slug || "").trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "otp_send_failed");
      setOtpSent(true);
    } catch (e: any) {
      setErr(e?.message || "otp_send_failed");
    } finally {
      setBusy(null);
    }
  }

  async function verifyOtp() {
    try {
      setErr(null);
      setBusy("verify");
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          phone: (phone || "").trim(),
          slug: (slug || "").trim(),
          token: (otp || "").trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || "otp_verify_failed");

      // refresh local client if needed
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        await supabase.auth.getUser().catch(() => null);
      }
      window.location.href = "/dashboard";
    } catch (e: any) {
      setErr(e?.message || "otp_verify_failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold">Sign in to Vyapr</h1>
      <p className="text-sm text-gray-600 mt-1">
        Choose any method. For phone, we’ll ping your WhatsApp first.
      </p>

{notice ? (
  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
    {notice}
  </div>
) : null}

      {/* OAuth buttons */}
      <div className="mt-6 grid gap-2">
        <button
          onClick={() => signInWith("google")}
          disabled={!!busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
        >
          <span>🔐 Continue with Google</span>
          {busy === "google" ? <span className="text-xs">…</span> : null}
        </button>

        <button
          onClick={() => (window.location.href = "/api/auth/apple")}
          disabled={!!busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-60"
        >
          <span> Continue with Apple</span>
          {busy === "apple" ? <span className="text-xs">…</span> : null}
        </button>
      </div>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-200" />
        <span>or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Phone → WhatsApp-first → OTP */}
      <form className="rounded-2xl border p-4 bg-white" onSubmit={requestWaCheck}>
        <div className="text-sm font-medium mb-1">Continue with Phone</div>
        <div className="grid gap-2">
          <label className="text-xs text-gray-600">
            WhatsApp number (with country code)
            <input
              type="tel"
              inputMode="tel"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>

          <label className="text-xs text-gray-600">
            Provider slug
            <input
              type="text"
              placeholder="your-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!!busy}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-white font-semibold disabled:opacity-60"
            >
              {busy === "wa" ? "Checking WhatsApp…" : "Check WhatsApp first"}
            </button>

            <button
              type="button"
              disabled={!!busy || waOk !== true}
              onClick={sendOtp}
              className="inline-flex flex-1 items-center justify-center rounded-xl border px-4 py-2 disabled:opacity-50"
              title={waOk === true ? "" : "Run WhatsApp check first"}
            >
              {busy === "send" ? "Sending OTP…" : "Send OTP"}
            </button>
          </div>

          {otpSent ? (
            <div className="grid gap-2">
              <label className="text-xs text-gray-600">
                Enter OTP
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  required
                />
              </label>
              <button
                type="button"
                onClick={verifyOtp}
                disabled={!!busy || !otp}
                className="inline-flex w-full items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-white font-semibold disabled:opacity-60"
              >
                {busy === "verify" ? "Verifying…" : "Verify & Sign in"}
              </button>
            </div>
          ) : null}

          {waOk === true ? (
            <div className="text-xs text-emerald-700">✅ WhatsApp check queued.</div>
          ) : null}
          {waOk === false ? (
            <div className="text-xs text-rose-700">
              Couldn’t queue WhatsApp check ({err || "unknown_error"}).
            </div>
          ) : null}
        </div>
      </form>

      {/* Error banner */}
      {err && !["wa", "send", "verify"].includes(String(busy)) ? (
        <div className="mt-3 text-xs text-rose-700">Error: {err}</div>
      ) : null}

      {/* Footer note */}
      <div className="mt-6 text-[11px] text-gray-500">
        By signing in, you agree to the Terms. We use Supabase Auth and will never share your data.
      </div>
    </main>
  );
}
