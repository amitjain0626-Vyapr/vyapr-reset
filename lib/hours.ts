// @ts-nocheck
/**
 * Debug-safe hours normalizer. Tolerant of messy inputs.
 * Returns { ui: string[], openingHoursSpecification: Spec[] }.
 * NOTE: Only used by /api/debug/* routes. Public pages are untouched.
 */

type Spec = { dayOfWeek?: string | string[]; opens?: string; closes?: string };
type Normalized = { ui: string[]; openingHoursSpecification: Spec[]; notes?: string[] };

const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_MAP: Record<string,string> = {
  mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday",
  fri:"Friday", sat:"Saturday", sun:"Sunday"
};

function pad2(n: number){ return (n<10?"0":"")+n; }
function hhmm(s: string){
  const m = String(s).trim().match(/^(\d{1,2})(?::?(\d{2}))?$/);
  if(!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1],10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2] ?? "0",10)));
  return `${pad2(h)}:${pad2(mm)}`;
}
function parseRange(s: string){
  const m = String(s).replace(/\s+/g,"").match(/^([^-\u2013]+)[-\u2013]([^-\u2013]+)$/);
  if(!m) return null;
  const o = hhmm(m[1]); const c = hhmm(m[2]);
  if(!o || !c) return null;
  return { opens:o, closes:c };
}
function expandDays(tok: string): string[] {
  const t = tok.toLowerCase();
  const single = t.slice(0,3);
  if (t.includes("-") || t.includes("–")) {
    const [a,b] = t.split(/[-–]/).map(x => x.trim().slice(0,3));
    if (DAYS.includes(a) && DAYS.includes(b)) {
      const i1 = DAYS.indexOf(a), i2 = DAYS.indexOf(b);
      return i1<=i2 ? DAYS.slice(i1,i2+1) : [...DAYS.slice(i1),...DAYS.slice(0,i2+1)];
    }
  }
  if (DAYS.includes(single)) return [single];
  return [];
}

export async function normalizeHours(rows: any[]): Promise<Normalized> {
  const ui: string[] = [];
  const specs: Spec[] = [];
  const notes: string[] = [];

  for (const row of rows || []) {
    if (typeof row === "string") {
      const s = row.trim();
      if (!s) continue;

      if (/closed/i.test(s)) {
        const m = s.match(/^([A-Za-z]{3})/);
        const d = m ? m[1] : "";
        const days = expandDays(d);
        days.forEach(dd => {
          specs.push({ dayOfWeek: DAY_MAP[dd], opens: "00:00", closes: "00:00" });
          ui.push(`${DAY_MAP[dd]}: Closed`);
        });
        continue;
      }

      // "Mon-Fri 09:00-17:00"
      const m = s.match(/^([A-Za-z]{3}(?:\s*[-–]\s*[A-Za-z]{3})?)\s+(.+)$/);
      if (m) {
        const dayTok = m[1]; const rest = m[2];
        const range = parseRange(rest);
        const days = expandDays(dayTok);
        if (range && days.length) {
          days.forEach(dd => specs.push({ dayOfWeek: DAY_MAP[dd], opens: range.opens, closes: range.closes }));
          const pretty = days.length>1 ? `${DAY_MAP[days[0]]}–${DAY_MAP[days[days.length-1]]}` : DAY_MAP[days[0]];
          ui.push(`${pretty}: ${range.opens}–${range.closes}`);
          continue;
        }
      }

      // pure range → Daily
      const r = parseRange(s);
      if (r) {
        DAYS.forEach(dd => specs.push({ dayOfWeek: DAY_MAP[dd], opens: r.opens, closes: r.closes }));
        ui.push(`Daily: ${r.opens}–${r.closes}`);
        continue;
      }

      notes.push(`ignored:string:${s}`);
    } else if (row && typeof row === "object") {
      const d = String(row.day || row.dayOfWeek || "").toLowerCase().slice(0,3);
      const o = hhmm(String(row.opens ?? ""));
      const c = hhmm(String(row.closes ?? ""));
      if (DAYS.includes(d) && o && c) {
        specs.push({ dayOfWeek: DAY_MAP[d], opens: o, closes: c });
        ui.push(`${DAY_MAP[d]}: ${o}–${c}`);
      } else {
        notes.push(`ignored:obj:${JSON.stringify(row)}`);
      }
    }
  }

  // dedupe identical lines
  const seen = new Set<string>();
  const merged: Spec[] = [];
  for (const s of specs) {
    const key = `${s.dayOfWeek}|${s.opens}|${s.closes}`;
    if (!seen.has(key)) { seen.add(key); merged.push(s); }
  }

  return { ui, openingHoursSpecification: merged, notes };
}
