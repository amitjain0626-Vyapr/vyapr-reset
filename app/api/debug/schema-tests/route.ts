// app/api/debug/schema-snapshots/route.ts
// @ts-nocheck

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  "https://vyapr-reset-5rly.vercel.app";

const TARGET_TYPES = new Set([
  "LocalBusiness",
  "FAQPage",
  "BreadcrumbList",
  "ItemList",
]);

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Vyapr-Debug/9.8" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

function extractJsonLdScripts(html: string): { raw: string }[] {
  const out: { raw: string }[] = [];
  const re =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (raw) out.push({ raw });
  }
  return out;
}

function flattenJsonLd(node: any): any[] {
  const acc: any[] = [];
  const push = (n: any) => {
    if (!n || typeof n !== "object") return;
    acc.push(n);
    if (Array.isArray(n)) {
      n.forEach(push);
      return;
    }
    if (n["@graph"] && Array.isArray(n["@graph"])) n["@graph"].forEach(push);
    for (const k of Object.keys(n)) {
      if (k === "@context") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(push);
      else if (v && typeof v === "object") push(v);
    }
  };
  push(node);
  return acc;
}

function countByType(nodes: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of TARGET_TYPES) counts[t] = 0;
  for (const n of nodes) {
    const t = n?.["@type"];
    if (!t) continue;
    if (typeof t === "string") {
      if (TARGET_TYPES.has(t)) counts[t] += 1;
    } else if (Array.isArray(t)) {
      for (const tt of t) if (typeof tt === "string" && TARGET_TYPES.has(tt)) counts[tt] += 1;
    }
  }
  return counts;
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {}
  const looksMulti = /\}\s*[\r\n]+\s*\{/.test(raw);
  if (looksMulti) {
    try {
      return JSON.parse(`[${raw.replace(/\}\s*[\r\n]+\s*\{/g, "},{")}]`);
    } catch {}
  }
  try {
    const deEnt = raw
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#39;/g, "'");
    return JSON.parse(deEnt);
  } catch {}
  return null;
}

function trimSample(s: string, max = 800): string {
  return s.length <= max ? s : s.slice(0, max) + "…";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = (searchParams.get("path") || "").trim();

  const payload = {
    ok: true,
    path,
    markers: ["VYAPR-9.8"],
    counts: {
      scripts: 0,
      byType: {
        LocalBusiness: 0,
        FAQPage: 0,
        BreadcrumbList: 0,
        ItemList: 0,
      },
    },
    samples: [] as string[],
    notes: [] as string[],
  };

  try {
    if (!path) {
      payload.notes.push("Missing ?path (e.g., /book/dr-kapoor)");
      return json(payload, 200);
    }

    const safePath = path.startsWith("/") ? path : "/" + path;
    const url = `${BASE}${safePath}${safePath.includes("?") ? "&" : "?"}now=${Date.now()}`;

    let html = "";
    try {
      const r = await fetchWithTimeout(url, 9000);
      if (!r.ok) {
        payload.notes.push(`Fetch failed (${r.status}) for ${url}`);
        return json(payload, 200);
      }
      html = await r.text();
    } catch (e: any) {
      payload.notes.push(`Fetch error for ${url}: ${e?.name || "error"}`);
      return json(payload, 200);
    }

    const scripts = extractJsonLdScripts(html);
    payload.counts.scripts = scripts.length;
    payload.samples = scripts.slice(0, 2).map((s) => trimSample(s.raw, 800));

    const nodes: any[] = [];
    for (const s of scripts) {
      const parsed = safeJsonParse(s.raw);
      if (!parsed) continue;
      nodes.push(...flattenJsonLd(parsed));
    }
    const byType = countByType(nodes);
    payload.counts.byType = {
      LocalBusiness: byType.LocalBusiness || 0,
      FAQPage: byType.FAQPage || 0,
      BreadcrumbList: byType.BreadcrumbList || 0,
      ItemList: byType.ItemList || 0,
    };

    return json(payload, 200);
  } catch (e: any) {
    // Fail‑open, never 500
    payload.notes.push(`Handler error: ${e?.message || "unknown"}`);
    return json(payload, 200);
  }
}
