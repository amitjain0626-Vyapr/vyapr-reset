// lib/telemetry.ts
// @ts-nocheck

// === VYAPR: Playbooks telemetry START (22.18) ===
// Goal: enforce a minimal, stable shape for telemetry payloads we originate.
// Contract: { event, ts(ms), provider_id, lead_id, source:{ playbook?: "reactivation"|"reminder"|"offer", via?: string } }
// - We DO NOT add columns. We only normalize values and strip obviously unsafe keys from `source` for outbound writes.
// - Downstream readers (e.g., debug endpoints) may still return extra keys added by server internals;
//   that's acceptable, but our *writes* should remain clean and predictable.

export type TelemetryRow = {
  event: string;
  ts: number;              // milliseconds
  provider_id: string;     // UUID
  lead_id: string | null;  // UUID or null
  source: Record<string, any>; // JSON
};

const PLAYBOOKS = new Set(["reactivation", "reminder", "offer"]);

export function asUuidOrNull(v: any): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  const uuid36 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return uuid36.test(s) ? s : null;
}

export function nowMs(): number {
  const n = Date.now();
  // Guard: ensure milliseconds (not seconds)
  return n < 10_000_000_000 ? n * 1000 : n;
}

/**
 * Normalize + guardrail a telemetry payload we are about to write.
 * - Ensures ms timestamp
 * - Coerces non-UUID lead_id to null
 * - Limits source keys to a safe allowlist + tiny passthrough of simple primitives
 */
export function normalizePlaybookSent(input: Partial<TelemetryRow>): TelemetryRow {
  const event = "playbook.sent";
  const ts = typeof input.ts === "number" ? (input.ts < 10_000_000_000 ? input.ts * 1000 : input.ts) : nowMs();
  const provider_id = String(input.provider_id || "").trim();
  const lead_id = asUuidOrNull(input.lead_id);

  // Build a trimmed source object
  const src = typeof input.source === "object" && input.source !== null ? input.source : {};
  const playbookRaw = String(src.playbook || "").toLowerCase().trim();
  const playbook = PLAYBOOKS.has(playbookRaw) ? playbookRaw : "reactivation";
  const via = String(src.via || "api.playbooks.send").trim();

  // Allowlist important keys; pass through a couple of simple primitives if present
  const safeSource: Record<string, any> = { playbook, via };
  // keep a minimal set of scalar hints for analytics (optional, non-breaking)
  ["count", "window", "category"].forEach((k) => {
    const v = (src as any)[k];
    if (v === undefined) return;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") safeSource[k] = v;
  });

  return { event, ts, provider_id, lead_id, source: safeSource };
}
// === VYAPR: Playbooks telemetry END (22.18) ===
