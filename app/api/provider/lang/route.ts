// app/api/provider/lang/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* ---------------------------- helpers (pure) ---------------------------- */
type Lang = "en" | "hi";
function normLang(v?: string | null): Lang | null {
  const t = String(v || "").trim().toLowerCase();
  if (t === "en") return "en";
  if (t === "hi" || t === "hinglish") return "hi";
  return null;
}
function parseCookie(cHeader?: string | null) {
  const map: Record<string, string> = {};
  if (!cHeader) return map;
  cHeader.split(";").forEach((part) => {
    const [k, ...rest] = part.split("=");
    if (!k) return;
    map[k.trim()] = decodeURIComponent((rest.join("=") || "").trim());
  });
  return map;
}

/* ------------------------------- POST (save) ------------------------------ */
/* Persists provider's own language preference. Requires auth (owner). */
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const lang = (normLang(body?.lang_pref) || "hinglish") === "hi" ? "hi" : "en"; // store as "en" | "hi"

    // Resolve provider
    const { data: profile, error: profErr } = await supabase
      .from("Providers")
      .select("id, lang_pref, slug")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message || "profile_lookup_failed" }, { status: 500 });
    }
    if (!profile?.id) {
      return NextResponse.json({ ok: false, error: "provider_not_found" }, { status: 404 });
    }

    // Update preference
    const { error: upErr } = await supabase
      .from("Providers")
      .update({ lang_pref: lang })
      .eq("id", profile.id);

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message || "update_failed" }, { status: 500 });
    }

    // Telemetry (best-effort, allowed fields only)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset-5rly.vercel.app"}/api/events/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "provider.lang.chosen",
          provider_id: profile.id,
          lead_id: null,
          source: { via: "web", lang, slug: profile.slug || null },
          ts: Date.now(),
        }),
      });
    } catch {}

    return NextResponse.json({ ok: true, lang });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unknown_error" }, { status: 500 });
  }
}

/* ------------------------------- GET (resolve) ---------------------------- */
/* Public, read-only resolver for UI/automation:
   Priority: ?lang → Cookie(korekko.lang) → (if logged in) Providers.lang_pref → "en"
   Keeps default language English globally. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const qLang = normLang(url.searchParams.get("lang"));
    if (qLang) return NextResponse.json({ ok: true, lang: qLang, via: "query" });

    // Cookie
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookie(cookieHeader);
    const cLang = normLang(cookies["korekko.lang"]);
    if (cLang) return NextResponse.json({ ok: true, lang: cLang, via: "cookie" });

    // If user is logged in, try Providers.lang_pref; otherwise fall back to "en"
    try {
      const supabase = await createSupabaseServerClient();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (user) {
        const { data: profile } = await supabase
          .from("Providers")
          .select("lang_pref")
          .eq("owner_id", user.id)
          .maybeSingle();
        const pLang = normLang(profile?.lang_pref);
        if (pLang) return NextResponse.json({ ok: true, lang: pLang, via: "provider_pref" });
      }
    } catch {
      // ignore — not fatal for public GET
    }

    // Default
    return NextResponse.json({ ok: true, lang: "en", via: "default" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "resolve_failed" }, { status: 500 });
  }
}
