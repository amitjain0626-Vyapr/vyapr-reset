// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Goal: Echo normalized hours (UI list + schema) for a few real‑world inputs.
 * Tries to use your project's lib/hours.normalizeHours.
 * If not found, uses a safe fallback normalizer (debug-only).
 */

type Spec = {
  dayOfWeek?: string | string[];
  opens?: string;
  closes?: string;
};

type NormalizedHours = {
  ui: string[];                           // human-readable lines
  openingHoursSpecification: Spec[];      // schema.org-compatible specs
  notes?: string[];
  sourceSample?: any[];
  usedFallback?: boolean;
};

// --- tiny helpers ---
const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_MAP: Record<string,string> = {
  mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday",
  fri:"Friday", sat:"Saturday", sun:"Sunday"
};
function pad2(n: number){ return (n<10?"0":"")+n; }
function hhmm(s: string){
  // accept "9", "9:30", "09:00", "18", "18:30"
  const m = String(s).trim().match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if(!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1],10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2] ?? "0",10)));
  return `${pad2(h)}:${pad2(mm)}`;
}
function parseRange(s: string){
  // "9-5" or "09:00-17:00" or "10-18:30"
  const m = String(s).replace(/\s+/g,"").match(/^([^-\u2013]+)[-\u2013]([^-\u2013]+)$/);
  if(!m) return null;
  const o = hhmm(m[1]); const c = hhmm(m[2]);
  if(!o || !c) return null;
  return { opens:o, closes:c };
}
function expandDayToken(tok: string): string[] {
  // "Mon-Fri", "Mon–Sat", "Tue", "sun"
  const t = tok.toLowerCase();
  const single = t.slice(0,3);
  if (t.includes("-") || t.includes("–")) {
    const parts = t.split(/[-–]/).map(x => x.trim().slice(0,3));
    if (parts.length === 2 && DAYS.includes(parts[0]) && DAYS.includes(parts[1])) {
      const i1 = DAYS.indexOf(parts[0]);
      const i2 = DAYS.indexOf(parts[1]);
      if (i1 <= i2) return DAYS.slice(i1, i2+1);
      // wrap-around (rare)
      return [...DAYS.slice(i1), ...DAYS.slice(0, i2+1)];
    }
  }
  if (DAYS.includes(single)) return [single];
  return [];
}

// --- fallback normalizer (debug-only, tolerant) ---
function fallbackNormalizeHours(sample: any[]): NormalizedHours {
  const ui: string[] = [];
  const specs: Spec[] = [];
  const notes: string[] = [];

  for (const row of sample) {
    if (typeof row === "string") {
      const s = row.trim();
      if (!s) continue;

      // "Sunday closed"
      if (/closed/i.test(s)) {
        const dTok = s.split(/\s+/)[0];
        const days = expandDayToken(dTok);
        days.forEach(d => {
          specs.push({ dayOfWeek: DAY_MAP[d], opens: "00:00", closes: "00:00" });
          ui.push(`${DAY_MAP[d]}: Closed`);
        });
        continue;
      }

      // "Mon-Fri 09:00-17:00"
      const m = s.match(/^([A-Za-z]{3}(?:\s*[-–]\s*[A-Za-z]{3})?)\s+(.+)$/);
      if (m) {
        const dayTok = m[1]; const rest = m[2];
        const range = parseRange(rest);
        const days = expandDayToken(dayTok);
        if (range && days.length) {
          days.forEach(d => {
            specs.push({ dayOfWeek: DAY_MAP[d], opens: range.opens, closes: range.closes });
          });
          const prettyDays = days.length>1
            ? `${DAY_MAP[days[0]]}–${DAY_MAP[days[days.length-1]]}`
            : DAY_MAP[days[0]];
          ui.push(`${prettyDays}: ${range.opens}–${range.closes}`);
          continue;
        }
      }

      // pure time range (apply to Mon–Sun)
      const onlyRange = parseRange(s);
      if (onlyRange) {
        DAYS.forEach(d => {
          specs.push({ dayOfWeek: DAY_MAP[d], opens: onlyRange.opens, closes: onlyRange.closes });
        });
        ui.push(`Daily: ${onlyRange.opens}–${onlyRange.closes}`);
        continue;
      }

      // otherwise ignore noisy strings
      notes.push(`ignored:string:${s}`);
    } else if (row && typeof row === "object") {
      // { day:"tue", opens:"10", closes:"18:30" }
      const d = String(row.day || row.dayOfWeek || "").toLowerCase().slice(0,3);
      const opens = hhmm(String(row.opens ?? ""));
      const closes = hhmm(String(row.closes ?? ""));
      if (DAYS.includes(d) && opens && closes) {
        specs.push({ dayOfWeek: DAY_MAP[d], opens, closes });
        ui.push(`${DAY_MAP[d]}: ${opens}–${closes}`);
      } else {
        notes.push(`ignored:obj:${JSON.stringify(row)}`);
      }
    }
  }

  // merge duplicates per day (keep first for simplicity)
  const seen = new Set<string>();
  const merged: Spec[] = [];
  specs.forEach(s => {
    const key = `${s.dayOfWeek}|${s.opens}|${s.closes}`;
    if (!seen.has(key)) { seen.add(key); merged.push(s); }
  });

  return {
    ui,
    openingHoursSpecification: merged,
    notes,
    sourceSample: sample,
    usedFallback: true,
  };
}

async function importOrFallback(inputs: any[]): Promise<NormalizedHours> {
  try {
    const mod = await import("@/lib/hours");                 // preferred
    if (mod?.normalizeHours) {
      const out = await mod.normalizeHours(inputs);
      return {
        ui: out.ui ?? out.lines ?? [],
        openingHoursSpecification: out.openingHoursSpecification ?? out.schema ?? out.specs ?? [],
        usedFallback: false,
        sourceSample: inputs,
        notes: out.notes ?? [],
      };
    }
  } catch {}
  try {
    const mod2 = await import("@/lib/seo/hours");            // alternates
    if (mod2?.normalizeHours) {
      const out = await mod2.normalizeHours(inputs);
      return {
        ui: out.ui ?? out.lines ?? [],
        openingHoursSpecification: out.openingHoursSpecification ?? out.schema ?? out.specs ?? [],
        usedFallback: false,
        sourceSample: inputs,
        notes: out.notes ?? [],
      };
    }
  } catch {}
  try {
    const mod3 = await import("@/lib/utils/hours");
    if (mod3?.normalizeHours) {
      const out = await mod3.normalizeHours(inputs);
      return {
        ui: out.ui ?? out.lines ?? [],
        openingHoursSpecification: out.openingHoursSpecification ?? out.schema ?? out.specs ?? [],
        usedFallback: false,
        sourceSample: inputs,
        notes: out.notes ?? [],
      };
    }
  } catch {}

  // fallback
  return fallbackNormalizeHours(inputs);
}

function json(body: any, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "default";

  // Sample hour strings covering real-world messiness
  const samples: Record<string, any[]> = {
    basic: [
      "Mon-Fri 09:00-17:00",
      { day: "sat", opens: "10", closes: "14:00" },
      "Sunday closed",
    ],
    mixed: [
      "Mon–Sat 10-20",
      "Sun 11-16",
      "invalid",
      { day: "wed", opens: "9", closes: "18:30" },
    ],
    daily: ["09:30-19:00"],
  };

  const pick = samples[mode] ?? samples.basic;
  const normalized = await importOrFallback(pick);

  return json({
    ok: true,
    markers: ["VYAPR-9.7", "VYAPR-HOURS-SAMPLES"],
    mode,
    input: pick,
    result: normalized,
  });
}
