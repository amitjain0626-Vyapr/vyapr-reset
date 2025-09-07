// app/api/debug/slots/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IST_TZ = "Asia/Kolkata";

function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
function roundToNextHalfHourIST(d: Date) {
  const z = new Date(d);
  const mins = z.getMinutes();
  const add = mins === 0 ? 0 : mins <= 30 ? 30 - mins : 60 - mins;
  z.setMinutes(mins + add, 0, 0);
  return z;
}
function getISTParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value!;
  const y = Number(get("year"));
  const m = Number(get("month"));
  const day = Number(get("day"));
  const h = Number(get("hour"));
  const wdStr = get("weekday"); // "Sun".."Sat"
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wdStr);
  return { y, m, day, wd, h };
}

async function resolveHours(slug: string) {
  try {
    const url = new URL(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/providers/resolve`);
    url.searchParams.set("slug", slug);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.hours || j?.data?.hours || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const days = Math.max(1, Math.min(30, Number(searchParams.get("days") || 14)));
  if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

  const now = new Date();
  const nowRounded = roundToNextHalfHourIST(now);

  const hoursRaw = await resolveHours(slug);
  const fallback = { startHour: 10, endHour: 19 };
  const hours: Record<number, { startHour: number; endHour: number } | null> = {};

  // map resolve() output if present; else all days fallback
  if (hoursRaw && typeof hoursRaw === "object") {
    for (let wd = 0; wd < 7; wd++) {
      const v = hoursRaw[String(wd)];
      if (!v || v.closed) hours[wd] = null;
      else if (typeof v.startHour === "number" && typeof v.endHour === "number")
        hours[wd] = { startHour: v.startHour, endHour: v.endHour };
      else hours[wd] = fallback;
    }
  } else {
    for (let wd = 0; wd < 7; wd++) hours[wd] = fallback;
  }

  const out: Array<{ date: string; slots: string[] }> = [];
  for (let i = 0; i < days; i++) {
    const base = addDays(now, i);
    const parts = getISTParts(base);
    const dateLocal = new Date(parts.y, parts.m - 1, parts.day);
    const cfg = hours[parts.wd];

    const slots: string[] = [];
    if (cfg) {
      for (let h = cfg.startHour; h < cfg.endHour; h++) {
        for (const min of [0, 30]) {
          const candidate = new Date(dateLocal);
          candidate.setHours(h, min, 0, 0);
          if (i === 0 && candidate < nowRounded) continue; // no past slots today
          slots.push(candidate.toISOString());
        }
      }
    }
    out.push({ date: new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, dateStyle: "medium" }).format(dateLocal), slots });
  }

  return NextResponse.json({ ok: true, slug, days, hoursResolved: !!hoursRaw, items: out });
}
