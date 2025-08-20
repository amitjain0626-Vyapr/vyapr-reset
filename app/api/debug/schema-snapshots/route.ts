// app/api/debug/schema-snapshots/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE =
  (process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app").replace(/\/+$/, "");
const TARGET_TYPES = new Set(["LocalBusiness", "FAQPage", "BreadcrumbList", "ItemList"]);

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

class AbortSignalController {
  controller: AbortController;
  timer: any;
  constructor(ms: number) {
    this.controller = new AbortController();
    this.timer = setTimeout(() => this.controller.abort(), ms);
  }
  get signal() {
    return this.controller.signal;
  }
  clear() {
    clearTimeout(this.timer);
  }
}

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const ctrl = new AbortSignalController(ms);
  try {
    return await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Vyapr-Debug/9.8" },
      signal: ctrl.signal,
    });
  } finally {
    ctrl.clear();
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
    if (Array.isArray(n)) return n.forEach(push);
    if ((n as any)["@graph"] && Array.isArray((n as any)["@graph"])) (n as any)["@graph"].forEach(push);
    for (const k of Object.keys(n)) {
      if (k === "@context") continue;
      const v = (n as any)[k];
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

type PathResult = {
  ok: true;
  path: string;
  markers: string[];
  counts: {
    scripts: number;
    byType: { LocalBusiness: number; FAQPage: number; BreadcrumbList: number; ItemList: number };
  };
  samples: string[];
  notes: string[];
};

async function analyzePath(path: string): Promise<PathResult> {
  const payload: PathResult = {
    ok: true,
    path,
    markers: ["VYAPR-9.8"],
    counts: {
      scripts: 0,
      byType: { LocalBusiness: 0, FAQPage: 0, BreadcrumbList: 0, ItemList: 0 },
    },
    samples: [],
    notes: [],
  };

  if (!path) {
    payload.notes.push("Missing path value");
    return payload;
  }

  const safePath = path.startsWith("/") ? path : "/" + path;
  const url = `${BASE}${safePath}${safePath.includes("?") ? "&" : "?"}now=${Date.now()}`;

  let html = "";
  try {
    const r = await fetchWithTimeout(url, 9000);
    if (!r.ok) {
      payload.notes.push(`Fetch failed (${r.status}) for ${url}`);
      return payload;
    }
    html = await r.text();
  } catch (e: any) {
    payload.notes.push(`Fetch error for ${url}: ${e?.name || "error"}`);
    return payload;
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

  return payload;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Batch mode: ?paths=/a,/b,/c
  const pathsParam = (searchParams.get("paths") || "").trim();
  if (pathsParam) {
    const paths = pathsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12); // hard cap to keep cheap

    const results: PathResult[] = [];
    for (const p of paths) {
      try {
        results.push(await analyzePath(p));
      } catch (e: any) {
        results.push({
          ok: true,
          path: p,
          markers: ["VYAPR-9.8"],
          counts: {
            scripts: 0,
            byType: { LocalBusiness: 0, FAQPage: 0, BreadcrumbList: 0, ItemList: 0 },
          },
          samples: [],
          notes: [`Handler error for ${p}: ${e?.message || "unknown"}`],
        });
      }
    }

    // Optional tiny summary
    const summary = {
      total: results.length,
      scripts: results.reduce((n, r) => n + (r.counts?.scripts || 0), 0),
    };

    return json(
      {
        ok: true,
        markers: ["VYAPR-9.8", "BATCH"],
        results,
        summary,
      },
      200
    );
  }

  // Single mode: ?path=/a
  const path = (searchParams.get("path") || "").trim();
  const single = await analyzePath(path);
  return json(single, 200);
}
