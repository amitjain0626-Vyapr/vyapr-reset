// app/api/debug/seed-demo/route.ts
// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";

// Force Node (not Edge) so we can do internal fetches comfortably
export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug") || "amitjain0626";
    const leadsCount = Math.max(1, Math.min(5, Number(url.searchParams.get("leads")) || 3));
    const origin = url.origin; // same deployment origin

    // Helpers
    async function post(path: string, body: any) {
      const res = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok && json?.ok !== false, status: res.status, json };
    }

    const NAMES = ["Aisha", "Vikram", "Neha", "Rohit", "Sara", "Arjun", "Meera", "Kabir", "Tanvi", "Kabir"];
    const results: any[] = [];
    const now = Date.now();
    let eventsInserted = 0;

    for (let i = 0; i < leadsCount; i++) {
      const name = `${NAMES[i % NAMES.length]} Seed ${i + 1}`;
      // simple Indian mobile placeholders
      const phone = `+91${(9876500000 + Math.floor(Math.random() * 9999)).toString()}`;

      // 1) Create lead via existing API (keeps schema/contracts intact)
      const created = await post("/api/leads/create", {
        slug,
        patient_name: name,
        phone,
        note: "seed: imported",
        source: { via: "seed-demo", idx: i + 1 },
      });
      if (!created.ok) {
        results.push({ step: "create", ok: false, error: created.json?.error || created.status });
        continue;
      }
      const lead_id = created.json?.id || created.json?.lead_id || created.json?.data?.id;
      const leadRow: any = { lead_id, patient_name: name, phone, steps: [] };

      // 2) Provider note
      {
        const r = await post("/api/leads/add-note", {
          lead_id,
          text: "Initial assessment done. Advise: hydration + rest.",
        });
        leadRow.steps.push({ step: "provider_note", ok: r.ok });
      }

      // 3) Customer note (simulated)
      {
        const r = await post("/api/leads/add-customer-note", {
          lead_id,
          text: "Sorry, got late today. Can we do tomorrow?",
        });
        leadRow.steps.push({ step: "customer_note", ok: r.ok });
      }

      // 4) A couple of timeline events (nudges + WA actions) via telemetry API
      //    We rely on /api/events/log (already used in app) to avoid schema drift.
      async function logEvent(event: string, source: any, offsetMins: number) {
        const r = await post("/api/events/log", {
          event,
          ts: now - offsetMins * 60 * 1000,
          provider_slug: slug,
          lead_id,
          source,
        });
        if (r.ok) eventsInserted++;
        return r.ok;
      }

      await logEvent("nudge.suggested", { via: "seed", reason: "overdue_48h" }, 240);
      await logEvent("wa.reminder.sent", { via: "seed", to: phone }, 180);
      await logEvent("wa.rebook.sent", { via: "seed", to: phone }, 60);

      results.push(leadRow);
    }

    return json({
      ok: true,
      slug,
      created: results.length,
      eventsInserted,
      leads: results,
      hint: "Open /dashboard/leads?slug=" + slug + " and the timeline drawers; also check /api/debug/events?limit=10",
    });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || "seed failed" }, 500);
  }
}
