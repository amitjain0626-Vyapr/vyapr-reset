// lib/slots/computeSlots.ts
export function computeSlots(days = 14, startHour = 10, endHour = 19, stepMins = 30) {
  const res: Array<{ label: string; dateISO: string; slots: Array<{ iso: string; hhmm: string }> }> = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);

    const label = d.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
    const slots: Array<{ iso: string; hhmm: string }> = [];

    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += stepMins) {
        const t = new Date(d);
        t.setHours(h, m, 0, 0);
        if (t.getTime() < Date.now() + 15 * 60 * 1000) continue; // 15-min guard
        const hh = String(h).padStart(2, "0");
        const mm = String(m).padStart(2, "0");
        slots.push({ iso: t.toISOString(), hhmm: `${hh}:${mm}` });
      }
    }

    res.push({ label, dateISO: d.toISOString(), slots });
  }
  return res;
}
