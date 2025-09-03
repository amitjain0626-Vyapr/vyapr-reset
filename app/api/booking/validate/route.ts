// app/api/booking/validate/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IST_TZ = "Asia/Kolkata";

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
  const wdStr = get("weekday"); // Sun..Sat
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wdStr);
  return { y, m, day, h, wd };
}

async function resolveHours(baseUrl: string, slug: string) {
  try {
    const u = new URL("/api/providers/resolve", baseUrl);
    u.searchParams.set("slug", slug);
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return j?.hours || j?.data?.hours || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const origin =
    req.headers.get("x-forwarded-proto") && req.headers.get("x-forwarded-host")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
      : process.env.NEXT_PUBLIC_BASE_URL || "";

  const { slug, slotISO } = await req.json().catch(() => ({}));
  if (!slug || !slotISO) {
    return NextResponse.json(
      { ok: false, error: "missing_params", detail: "slug and slotISO are required" },
      { status: 400 }
    );
  }

  // Parse slot time
  const slot = new Date(slotISO);
  if (isNaN(slot.getTime())) {
    return NextResponse.json(
      { ok: false, error: "invalid_slotISO" },
      { status: 400 }
    );
  }

  // No past slots (IST)
  const now = new Date();
  const nowRounded = roundToNextHalfHourIST(now);
  if (slot < nowRounded) {
    return NextResponse.json(
      { ok: false, error: "slot_in_past" },
      { status: 400 }
    );
  }

  // Provider hours
  const hoursRaw = await resolveHours(origin, slug);
  const fallback = { startHour: 10, endHour: 19 };
  const parts = getISTParts(slot);
  const window =
    (hoursRaw && hoursRaw[String(parts.wd)] && !hoursRaw[String(parts.wd)].closed
      ? {
          startHour:
            typeof hoursRaw[String(parts.wd)].startHour === "number"
              ? hoursRaw[String(parts.wd)].startHour
              : fallback.startHour,
          endHour:
            typeof hoursRaw[String(parts.wd)].endHour === "number"
              ? hoursRaw[String(parts.wd)].endHour
              : fallback.endHour,
        }
      : fallback);

  // Out-of-hours?
  if (parts.h < window.startHour || parts.h >= window.endHour) {
    return NextResponse.json(
      {
        ok: false,
        error: "slot_out_of_hours",
        detail: { weekday: parts.wd, startHour: window.startHour, endHour: window.endHour },
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    slug,
    slotISO,
    hoursResolved: !!hoursRaw,
    withinHours: true,
  });
}
