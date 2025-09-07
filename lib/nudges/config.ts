// @ts-nocheck
import { createAdminClient } from "../supabase/admin";

/**
 * Read the most recent nudge.config.updated event for a provider.
 * Falls back to {quiet_start: 22, quiet_end: 8, cap: 25}.
 */
export async function getLatestNudgeConfig(providerSlug: string) {
  const admin = createAdminClient();

  // Resolve provider_id from slug
  const { data: provider } = await admin
    .from("Providers")
    .select("id, slug")
    .eq("slug", providerSlug)
    .single();

  if (!provider) {
    return { providerId: null, config: { quiet_start: 22, quiet_end: 8, cap: 25 } };
  }

  // Find last config event
  const { data: events } = await admin
    .from("Events")
    .select("event, ts, source")
    .eq("provider_id", provider.id)
    .eq("event", "nudge.config.updated")
    .order("ts", { ascending: false })
    .limit(1);

  const fallback = { quiet_start: 22, quiet_end: 8, cap: 25 };
  if (!events || !events.length) return { providerId: provider.id, config: fallback };

  const src = events[0].source || {};
  const cfg = {
    quiet_start: Number(src.quiet_start ?? fallback.quiet_start),
    quiet_end: Number(src.quiet_end ?? fallback.quiet_end),
    cap: Number(src.cap ?? fallback.cap),
  };
  return { providerId: provider.id, config: cfg };
}

/** True if current IST hour is within quiet window */
export function isQuietHourIST(now: Date, quiet_start: number, quiet_end: number) {
  // IST offset +05:30
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hour = ist.getHours();

  // Quiet window may wrap midnight (e.g., 22 → 8)
  if (quiet_start <= quiet_end) {
    return hour >= quiet_start && hour < quiet_end;
  }
  return hour >= quiet_start || hour < quiet_end;
}
