// @ts-nocheck
// lib/hours.ts

/**
 * Input can be:
 * - Array<{ day: string, opens?: string, closes?: string }>
 * - Array<string> like "Mon 09:00-17:00"
 * - null/undefined → []
 * Fail-open & tolerant. Returns both UI list and Schema.org OpeningHoursSpecification[].
 */

const DAY_ALIASES: Record<string, string> = {
  mon: "Monday", monday: "Monday",
  tue: "Tuesday", tues: "Tuesday", tuesday: "Tuesday",
  wed: "Wednesday", wednesday: "Wednesday",
  thu: "Thursday", thur: "Thursday", thurs: "Thursday", thursday: "Thursday",
  fri: "Friday", friday: "Friday",
  sat: "Saturday", saturday: "Saturday",
  sun: "Sunday", sunday: "Sunday",
};

function toDayOfWeek(raw?: string) {
  if (!raw) return undefined;
  const key = raw.toLowerCase().replace(/\./g, "").trim();
  return DAY_ALIASES[key];
}

function toTimeHHMM(raw?: string) {
  if (!raw) return undefined;
  const s = raw.trim();
  // Accept 9, 09, 9:00, 9.00, 09:30, 9:30am, 9am, 9 PM, etc.
  const m = s.match(/(\d{1,2})(?::|\.|)?(\d{2})?\s*(am|pm)?/i);
  if (!m) return undefined;
  let hh = parseInt(m[1], 10);
  let mm = m[2] ? parseInt(m[2], 10) : 0;
  const ap = m[3]?.toLowerCase();

  if (ap === "pm" && hh < 12) hh += 12;
  if (ap === "am" && hh === 12) hh = 0;

  if (Number.isNaN(hh) || Number.isNaN(mm)) return undefined;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return undefined;

  const H = String(hh).padStart(2, "0");
  const M = String(mm).padStart(2, "0");
  return `${H}:${M}`;
}

export type NormalizedHours = {
  uiList: string[]; // e.g., ["Mon: 09:00–17:00"]
  openingHoursSpecification: Array<{
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens?: string;
    closes?: string;
  }>;
};

export function normalizeHours(input: unknown): NormalizedHours {
  const uiList: string[] = [];
  const spec: any[] = [];

  if (!Array.isArray(input)) {
    return { uiList, openingHoursSpecification: spec };
  }

  for (const item of input) {
    let day: string | undefined;
    let opens: string | undefined;
    let closes: string | undefined;

    if (typeof item === "string") {
      // "Mon 09:00-17:00"
      const m = item.match(
        /^\s*([A-Za-z\.]+)\s+(\d{1,2}(:|\.)?\d{0,2}\s*(am|pm)?)\s*-\s*(\d{1,2}(:|\.)?\d{0,2}\s*(am|pm)?)\s*$/i
      );
      if (m) {
        day = toDayOfWeek(m[1]);
        opens = toTimeHHMM(m[2]);
        closes = toTimeHHMM(m[5]);
      } else {
        // Try just day
        day = toDayOfWeek(item);
      }
    } else if (item && typeof item === "object") {
      day = toDayOfWeek(item.day || item.dayOfWeek);
      opens = toTimeHHMM(item.opens);
      closes = toTimeHHMM(item.closes);
    }

    if (!day) continue;
    const o: any = { "@type": "OpeningHoursSpecification", dayOfWeek: day };
    if (opens) o.opens = opens;
    if (closes) o.closes = closes;

    spec.push(o);

    // UI string
    let label = day.slice(0, 3); // Mon, Tue...
    if (opens && closes) {
      uiList.push(`${label}: ${opens}–${closes}`);
    } else if (opens) {
      uiList.push(`${label}: from ${opens}`);
    } else if (closes) {
      uiList.push(`${label}: until ${closes}`);
    } else {
      uiList.push(`${label}: Open`);
    }
  }

  return { uiList, openingHoursSpecification: spec };
}
