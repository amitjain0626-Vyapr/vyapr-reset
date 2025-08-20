// app/api/debug/schema-snapshots/route.ts
// @ts-nocheck

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE =
  process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, "") ||
  "https://vyapr-reset-5rly.vercel.app";

const TARGET_TYPES = new Set([
  "LocalBusiness",
  "FAQPage",
  "BreadcrumbList",
  "ItemList",
]);

// Safe, short timeout fetch
async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      // Force dynamic fetch; avoid Next/Vercel caching
      cache: "no-store",
      headers: { "User-Agent": "Vyapr-Debug/9.8" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(id);
  }
}

// Extract <script type="application/ld+json">...</script> blocks with a tolerant regex
function extractJsonLdScripts(html: string): { raw: string; idx: number }[] {
  const out: { raw: string; idx: number }[] = [];
  const re =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(html))) {
    const raw = (m[1] || "").trim();
    if (raw) out.push({ raw, idx: i++ });
  }
  return out;
}

// Flatten a JSON-LD node (object/array/@graph) into list of nodes with @type
function flattenJsonLd(node: any): any[] {
  const acc: any[] = [];
  const push = (n: any) => {
    if (!n || typeof n !== "object") return;
    acc.push(n);
    if (Array.isArray(n)) {
      n.forEach(push);
    } else {
      if (n["@graph"] && Array.isArray(n["@graph"])) n["@graph"].forEach(push);
      // Some publishers nest arrays under "itemListElement" etc.
      for (const k of Object.keys(n)) {
        const v = n[k];
        if (Array.isArray(v)) v.forEach(push);
        else if (v && typeof v === "object") {
          // avoid infinite recursion on circulars (unlikely)
          if (k !== "@context") push(v);
        }
      }
    }
  };
  push(node);
  return acc;
}

function countByType(nodes: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of TARGET_TYPES) counts[t] = 0;

  for (const n of nodes) {
    const t = n && n["@type"];
    if (!t) continue;
    if (typeof t === "string") {
      if (TARGET_TYPES.has(t)) counts[t] += 1;
    } else if (Array.isArray(t)) {
      for (const tt of t) {
        if (typeof tt === "string" && TARGET_TYPES.has(tt)) counts[tt] += 1;
      }
    }
  }
  return counts;
}

function safeJsonParse(raw: string): any | null {
  // Try as-is
  try {
    return JSON.parse(raw);
  } catch {}
  // Some sites wrap multiple objects without array — try to coerce
  // Attempt: wrap in [ ... ] if looks like multiple top-level objects
  const looksMulti =
    (raw.match(/^\s*\{/m) && raw.match(/\}\s*\{/m)) || raw.includes("\n}{");
  if (looksMulti) {
    try {
      return JSON.parse(`[${raw.replace(/\}\s*\n*\s*\{/g, "},{")}]`);
    } catch {}
  }
  // Last resort: try to strip HTML entities for quotes
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
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = (searchParams.get("path") || "").trim();

  const markers = ["VYAPR-9.8"];
  const result = {
    ok: true,
    path,
    markers,
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

  // Fail-open: always return JSON with marker, never 500.
  if (!path) {
    result.notes.push("Missing ?path. Example: /book/dr-kapoor");
    return NextResponse.json(result, { status: 200 });
  }

  // SSRF guard: must start with /
  const safePath = path.startsWith("/") ? path : "/" + path;
  const url = `${BASE}${safePath}${
    safePath.includes("?") ? "&" : "?"
  }now=${Date.now()}`;

  let html = "";
  try {
    const r = await fetchWithTimeout(url, 9000);
    if (!r.ok) {
      result.notes.push(`Fetch failed (${r.status}) for ${url}`);
      return NextResponse.json(result, { status: 200 });
    }
    html = await r.text();
  } catch (e: any) {
    result.notes.push(`Fetch error for ${url}: ${e?.name || "error"}`);
    return NextResponse.json(result, { status: 200 });
  }

  const scripts = extractJsonLdScripts(html);
  result.counts.scripts = scripts.length;
  result.samples = scripts.slice(0, 2).map((s) => trimSample(s.raw, 800));

  // Parse & count target types (tolerant)
  const nodes: any[] = [];
  for (const s of scripts) {
    const parsed = safeJsonParse(s.raw);
    if (!parsed) continue;
    const flat = flattenJsonLd(parsed);
    nodes.push(...flat);
  }
  const byType = countByType(nodes);
  result.counts.byType = {
    LocalBusiness: byType.LocalBusiness || 0,
    FAQPage: byType.FAQPage || 0,
    BreadcrumbList: byType.BreadcrumbList || 0,
    ItemList: byType.ItemList || 0,
  };

  return NextResponse.json(result, { status: 200 });
}
