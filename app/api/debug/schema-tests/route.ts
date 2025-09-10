// app/api/debug/schema-tests/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE =
  (process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app").replace(/\/+$/, "");

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
      headers: { "User-Agent": "Korekko-Debug/9.8" },
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

/** Parse expect=LocalBusiness:1,FAQPage:1 */
function parseExpect(expectParam: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!expectParam) return out;
  for (const part of expectParam.split(",")) {
    const [kRaw, vRaw] = part.split(":").map((s) => (s || "").trim());
    if (!kRaw) continue;
    const key = kRaw.replace(/\s+/g, "");
    const proper =
      [...TARGET_TYPES].find((t) => t.toLowerCase() === key.toLowerCase()) || null;
    if (!proper) continue;
    const n = Number(vRaw);
    if (Number.isFinite(n) && n >= 0) out[proper] = n;
  }
  return out;
}

type AssertResult = {
  pass: boolean;
  expected: Record<string, number>;
  actual: Record<string, number>;
  deltas: Record<string, number>;
};

function assertCounts(actualByType: Record<string, number>, expected: Record<string, number>): AssertResult {
  const actual: Record<string, number> = {};
  const deltas: Record<string, number> = {};
  let pass = true;
  for (const t of TARGET_TYPES) actual[t] = actualByType[t] || 0;
  for (const k of Object.keys(expected)) {
    const a = actual[k] || 0;
    const e = expected[k] || 0;
    const d = a - e;
    deltas[k] = d;
    if (a !== e) pass = false;
  }
  return { pass, expected, actual, deltas };
}

type PathResult = {
  ok: true;
  path: string;
  markers: string[];
  counts: {
    scripts: number;
    byType: { LocalBusiness: number; FAQPage: number; BreadcrumbList: number; ItemList: number };
  };
  assert?: AssertResult;
  samples: string[];
  notes: string[];
};

async function analyzePath(path: string, expected: Record<string, number>): Promise<PathResult> {
  const payload: PathResult = {
    ok: true,
    path,
    markers: ["KOREKKO-9.8"],
    counts: {
      scripts: 0,
      byType: { LocalBusiness: 0, FAQPage: 0, BreadcrumbList: 0, ItemList: 0 },
    },
    samples: [],
    notes: [],
  };

  if (!path) {
    payload.notes.push("Missing path value");
    if (Object.keys(expected).length) payload.markers.push("EXPECT");
    return payload;
  }

  const safePath = path.startsWith("/") ? path : "/" + path;
  const url = `${BASE}${safePath}${safePath.includes("?") ? "&" : "?"}now=${Date.now()}`;

  let html = "";
  try {
    const r = await fetchWithTimeout(url, 9000);
    if (!r.ok) {
      payload.notes.push(`Fetch failed (${r.status}) for ${url}`);
      if (Object.keys(expected).length) payload.markers.push("EXPECT");
      return payload;
    }
    html = await r.text();
  } catch (e: any) {
    payload.notes.push(`Fetch error for ${url}: ${e?.name || "error"}`);
    if (Object.keys(expected).length) payload.markers.push("EXPECT");
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

  if (Object.keys(expected).length) {
    payload.markers.push("EXPECT");
    payload.assert = assertCounts(payload.counts.byType, expected);
    if (payload.assert.pass) payload.markers.push("ASSERT-PASS");
    else payload.markers.push("ASSERT-FAIL");
  }

  return payload;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const expected = parseExpect((searchParams.get("expect") || "").trim());

  // Batch mode
  const pathsParam = (searchParams.get("paths") || "").trim();
  if (pathsParam) {
    const paths = pathsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    const results: PathResult[] = [];
    for (const p of paths) {
      try {
        results.push(await analyzePath(p, expected));
      } catch (e: any) {
        results.push({
          ok: true,
          path: p,
          markers: ["KOREKKO-9.8", ...(Object.keys(expected).length ? ["EXPECT", "ASSERT-FAIL"] : [])],
          counts: {
            scripts: 0,
            byType: { LocalBusiness: 0, FAQPage: 0, BreadcrumbList: 0, ItemList: 0 },
          },
          assert: Object.keys(expected).length
            ? { pass: false, expected, actual: { LocalBusiness: 0, FAQPage: 0, BreadcrumbList: 0, ItemList: 0 }, deltas: {} }
            : undefined,
          samples: [],
          notes: [`Handler error for ${p}: ${e?.message || "unknown"}`],
        });
      }
    }

    const allHaveAssert = results.every((r) => !!expected && !!r.assert);
    const pass = allHaveAssert ? results.every((r) => r.assert?.pass) : true;

    return json(
      {
        ok: true,
        markers: ["KOREKKO-9.8", "BATCH", ...(Object.keys(expected).length ? ["EXPECT", pass ? "ASSERT-PASS" : "ASSERT-FAIL"] : [])],
        expected,
        results,
        summary: {
          total: results.length,
          scripts: results.reduce((n, r) => n + (r.counts?.scripts || 0), 0),
          pass,
        },
      },
      200
    );
  }

  // Single mode
  const path = (searchParams.get("path") || "").trim();
  const single = await analyzePath(path, expected);
  return json(single, 200);
}
