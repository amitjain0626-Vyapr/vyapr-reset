// lib/slots/computeSlots.ts
// @ts-nocheck

/**
 * Compute slots as strict IST strings (no JS Date conversions).
 * Returns array of { label, slots:[{iso}] }
 */
export function computeSlots(
  days: number,
  startHour: number,
  endHour: number,
  stepMins: number
) {
  const out: any[] = [];
  const now = new Date();

  for (let d = 0; d < days; d++) {
    const day = new Date();
    day.setDate(now.getDate() + d);

    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, "0");
    const dd = String(day.getDate()).padStart(2, "0");

    const label = day.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const slots: any[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += stepMins) {
        const hh = String(h).padStart(2, "0");
        const mi = String(m).padStart(2, "0");
        // Build strict IST string — no new Date()
        const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+05:30`;
        slots.push({ iso });
      }
    }

    out.push({ label, slots });
  }

  return out;
}
