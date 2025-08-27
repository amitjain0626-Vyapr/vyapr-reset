// lib/wa/templates.ts
// @ts-nocheck

export type WaParams = {
  name?: string;                 // "Aisha"
  provider?: string;             // "Dr. Kapoor Clinic"
  slug?: string;                 // "amitjain0626"
  slot?: string;                 // "Tue 4:30 PM"
  link?: string;                 // optional override
  // Attribution (NEW)
  leadId?: string;               // used as ?lid=
  kind?: "reminder" | "rebook";  // used for utm_campaign
  campaign?: string;             // override campaign name
};

// Internal: builds a tracked link (unique name to avoid any prior duplicates)
function buildBookingLink(p: WaParams) {
  const raw = p.link || (p.slug ? `https://vyapr.com/book/${p.slug}` : "https://vyapr.com");
  try {
    const u = new URL(raw);
    u.searchParams.set("utm_source", "whatsapp");
    u.searchParams.set("utm_medium", "message");
    u.searchParams.set("utm_campaign", (p.campaign || p.kind || "general") as string);
    if (p.leadId) u.searchParams.set("lid", p.leadId);
    u.searchParams.set("utm_content", "vyapr-default");
    return u.toString();
  } catch {
    return raw; // never throw
  }
}

export function waReminder(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "your clinic").trim();
  const slot = (p.slot || "").trim();
  const link = buildBookingLink({ ...p, kind: "reminder" });

  const line1 = `Hi${who}, quick reminder from ${provider}.`;
  const line2 = slot ? `Can we confirm your ${slot} appointment?` : `Can we confirm your appointment?`;
  const line3 = `Reply YES to confirm or pick another time: ${link}`;
  return `${line1} ${line2} ${line3}`;
}

export function waRebook(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "your clinic").trim();
  const link = buildBookingLink({ ...p, kind: "rebook" });

  const line1 = `Hi${who}, this is ${provider}.`;
  const line2 = `We missed you last time — want to rebook for this week?`;
  const line3 = link;
  return `${line1} ${line2} ${line3}`;
}

// Extras (optional, drafted for GTM library)
export function waThankYou(p: WaParams) {
  const name = (p.name || "").trim();
  const who = name ? ` ${name}` : "";
  const provider = (p.provider || "our clinic").trim();
  return `Thanks${who} for visiting ${provider} today. If anything felt off, just reply here — we’ll make it right.`;
}

export function waReviewNudge(p: WaParams) {
  const provider = (p.provider || "our clinic").trim();
  const link = buildBookingLink(p);
  return `It'd mean a lot if you could rate ${provider}. It helps others discover us: ${link}`;
}
