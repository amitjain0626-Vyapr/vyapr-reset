// app/api/availability/resolve/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IST_TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

function roundToNextHalfHourIST(d: Date) {
  const z = new Date(d);
  const m = z.getMinutes();
  const add = m === 0 ? 0 : m <= 30 ? 30 - m : 60 - m;
  z.setMinutes(m + add, 0, 0);
  return z;
}
function fmtIST(d: Date, opts: any) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST_TZ, ...opts }).format(d);
}
function getISTParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value!;
  const y = +get("year"), m = +get("month"), day = +get("day"), h = +get("hour");
  const wdStr = get("weekday"); // Sun..Sat
  const wd = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(wdStr);
  return { y, m, day, h, wd };
}
function toLocalDateYMD(d: Date) {
  const { y, m, day } = getISTParts(d);
  return new Date(y, m - 1, day); // JS local (only for constructing hour/min below)
}
function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && bStart < aEnd;
}

async function resolveProviderHours(baseUrl: string, slug: string) {
  try {
    const u = new URL("/api/providers/resolve", baseUrl);
    u.searchParams.set("slug", slug);
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) return { hours: null, resolved: false };
    const j = await res.json();
    const hours = j?.hours || j?.data?.hours || null;
    return { hours: hours || null, resolved: !!hours };
  } catch {
    return { hours: null, resolved: false };
  }
}

type BusyBlock = { start: string; end: string };

async function fetchBusyBlocks(baseUrl: string, slug: string, rangeStartISO: string, rangeEndISO: string): Promise<BusyBlock[]> {
  // We call your existing Google Calendar route. Today it echoes the body (TODO),
  // so if there is no busy[] array we simply treat as "no busy time".
  try {
    const u = new URL("/api/google-calendar/sync", baseUrl);
    const res = await fetch(u.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ slug, rangeStartISO, rangeEndISO, intent: "freeBusy" }),
    });
    if (!res.ok) return [];
    const j = await res.json();
    const busy = j?.busy || j?.received?.busy || [];
    if (!Array.isArray(busy)) return [];
    // keep only items with {start,end}
    return busy
      .map((b: any) => ({ start: String(b?.start || ""), end: String(b?.end || "") }))
      .filter(b => b.start && b.end && !isNaN(new Date(b.start).getTime()) && !isNaN(new Date(b.end).getTime()));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const days = Math.max(1, Math.min(30, Number(searchParams.get("days") || 14)));

  if (!slug) return NextResponse.json({ ok: false, error: "missing_slug" }, { status: 400 });

  // Base URL (works on Vercel and local)
  const baseUrl =
    (req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host"))
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
      : (process.env.NEXT_PUBLIC_BASE_URL || "");

  // 1) Provider hours
  const { hours, resolved: hoursResolved } = await resolveProviderHours(baseUrl, slug);
  const fallback = { startHour: 10, endHour: 19 };

  // 2) Compute date range and busy blocks (Google freeBusy via your /sync route)
  const now = new Date();
  const nowRounded = roundToNextHalfHourIST(now);
  const rangeStartISO = nowRounded.toISOString();
  const rangeEndISO = new Date(now.getTime() + days * DAY_MS).toISOString();
  const busy = await fetchBusyBlocks(baseUrl, slug, rangeStartISO, rangeEndISO);

  // 3) Generate free slots: (working hours) − (busy)
  const out: Array<{ date: string; slots: string[] }> = [];
  for (let i = 0; i < days; i++) {
    const base = new Date(now.getTime() + i * DAY_MS);
    const parts = getISTParts(base);
    const dateLocal = toLocalDateYMD(base);

    const cfg = (hours && hours[String(parts.wd)] && !hours[String(parts.wd)].closed)
      ? {
          startHour: typeof hours[String(parts.wd)].startHour === "number" ? hours[String(parts.wd)].startHour : fallback.startHour,
          endHour: typeof hours[String(parts.wd)].endHour === "number" ? hours[String(parts.wd)].endHour : fallback.endHour,
        }
      : fallback;

    const slots: string[] = [];
    for (let h = cfg.startHour; h < cfg.endHour; h++) {
      for (const m of [0, 30]) {
        const from = new Date(dateLocal);
        from.setHours(h, m, 0, 0);
        const to = new Date(from.getTime() + 30 * 60 * 1000);

        // no past slots for "today"
        if (i === 0 && from < nowRounded) continue;

        // subtract busy blocks (if any)
        const conflicts = busy.some(b => {
          const bStart = new Date(b.start);
          const bEnd = new Date(b.end);
          return overlaps(from, to, bStart, bEnd);
        });
        if (!conflicts) slots.push(from.toISOString());
      }
    }

    out.push({
      date: fmtIST(dateLocal, { dateStyle: "medium" }),
      slots,
    });
  }

  return NextResponse.json({
    ok: true,
    slug,
    days,
    hoursResolved,
    busyCount: busy.length,
    items: out,
  });
}
