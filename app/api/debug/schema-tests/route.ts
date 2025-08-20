// @ts-nocheck
import { NextResponse } from "next/server";
import { buildBreadcrumbs, buildLocalBusiness, buildFaqPage } from "@/lib/schema";
import { normalizeHours } from "@/lib/hours";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Case = { name: string; builder: string; pass: boolean; details: any };

function isObj(v: any) { return v && typeof v === "object"; }

function bcPass(o: any) {
  return (
    isObj(o) &&
    o["@type"] === "BreadcrumbList" &&
    Array.isArray(o.itemListElement)
  );
}
function lbPass(o: any) {
  return isObj(o) && o["@type"] === "LocalBusiness";
}
function faqPass(o: any, allowNull = true) {
  if (o == null) return allowNull; // omit is allowed
  return isObj(o) && o["@type"] === "FAQPage" && Array.isArray(o.mainEntity);
}
function hoursPass(o: any) {
  // Accept normalized shape from lib/hours.ts
  if (!o) return false;
  if (Array.isArray(o.openingHoursSpecification)) return true;
  // Allow our API route to pass through full object { ui, openingHoursSpecification, ... }
  if (isObj(o) && Array.isArray(o.openingHoursSpecification)) return true;
  if (isObj(o) && Array.isArray(o.schema)) return true;
  return false;
}

async function addCase(cases: Case[], name: string, builder: string, fn: () => any | Promise<any>) {
  try {
    const out = fn();
    const res = out?.then ? await out : out;
    cases.push({ name, builder, pass: true, details: res });
  } catch (e: any) {
    cases.push({
      name, builder, pass: false,
      details: { error: String(e?.message || e), stack: (e?.stack || "").split("\n").slice(0, 2) }
    });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("ping")) {
    return NextResponse.json({ ok: true, markers: ["VYAPR-9.7"], ping: true, now: new Date().toISOString() });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;
  const cases: Case[] = [];

  // 1) Breadcrumbs: 3‑segment
  await addCase(cases, "Breadcrumbs: 3-segment", "buildBreadcrumbs", () => {
    const bcTrail = [
      { name: "Home", url: `${base}/` },
      { name: "Directory", url: `${base}/directory` },
      { name: "Dance in Pune", url: `${base}/directory/dance-pune` },
    ];
    const out = buildBreadcrumbs(bcTrail);
    if (!bcPass(out)) throw new Error("Unexpected BreadcrumbList shape");
    return out;
  });

  // 2) Breadcrumbs: empty trail
  await addCase(cases, "Breadcrumbs: empty", "buildBreadcrumbs", () => {
    const out = buildBreadcrumbs([]);
    if (!bcPass(out)) throw new Error("Unexpected empty BreadcrumbList shape");
    return out;
  });

  // 3) Hours: mixed normalization
  const hoursMixed = await (async () => {
    const inputs = [
      "Mon-Fri 09:00-17:00",
      { day: "tue", opens: "10", closes: "18:30" },
      "Sunday closed",
      "invalid",
    ];
    const nh = await normalizeHours(inputs);
    if (!hoursPass(nh)) throw new Error("normalizeHours mixed shape unexpected");
    return nh;
  })();

  await addCase(cases, "Hours: mixed normalization", "normalizeHours", () => hoursMixed);

  // 4) Hours: invalid-only
  await addCase(cases, "Hours: invalid-only", "normalizeHours", async () => {
    const nh = await normalizeHours(["nonsense", "xx"]);
    if (!hoursPass(nh)) throw new Error("normalizeHours invalid-only shape unexpected");
    return nh;
  });

  // 5) LocalBusiness: full object
  await addCase(cases, "LocalBusiness: full", "buildLocalBusiness", () => {
    const out = buildLocalBusiness({
      name: "Dr Kapoor Clinic",
      slug: "dr-kapoor",
      url: `${base}/book/dr-kapoor`,
      priceRange: "₹₹",
      telephone: "+91-99999-99999",
      address: {
        streetAddress: "12 MG Road",
        addressLocality: "Pune",
        addressRegion: "MH",
        postalCode: "411001",
        addressCountry: "IN",
      },
      geo: { latitude: 18.5204, longitude: 73.8567 },
      openingHoursSpecification: hoursMixed.openingHoursSpecification || [],
    });
    if (!lbPass(out)) throw new Error("LocalBusiness full shape unexpected");
    return out;
  });

  // 6) LocalBusiness: minimal
  await addCase(cases, "LocalBusiness: minimal", "buildLocalBusiness", () => {
    const out = buildLocalBusiness({ slug: "amit", url: `${base}/book/amit` });
    if (!lbPass(out)) throw new Error("LocalBusiness minimal shape unexpected");
    return out;
  });

  // 7) FAQPage: full
  await addCase(cases, "FAQPage: full", "buildFaqPage", () => {
    const items = [
      { question: "What are the consultation hours?", answer: "Mon–Fri, 10am–6pm." },
      { question: "How much is the first visit?", answer: "₹500." },
    ];
    const out = buildFaqPage(items);
    if (!faqPass(out, false)) throw new Error("FAQ full shape unexpected");
    return out;
  });

  // 8) FAQPage: single empty pair → should omit/null but still pass
  await addCase(cases, "FAQPage: single empty pair", "buildFaqPage", () => {
    const out = buildFaqPage([{ question: "", answer: "" }]);
    if (!faqPass(out, true)) throw new Error("FAQ empty-pair handling unexpected");
    return out ?? null;
  });

  // 9) FAQPage: empty array → omit/null
  await addCase(cases, "FAQPage: empty array → omit", "buildFaqPage", () => {
    const out = buildFaqPage([]);
    if (!faqPass(out, true)) throw new Error("FAQ empty handling unexpected");
    return out ?? null;
  });

  // 10) Combined: LocalBusiness + normalizeHours
  await addCase(cases, "Combined: LB + normalizeHours", "buildLocalBusiness", async () => {
    const nh = await normalizeHours(["Mon 09:00-17:00", "Tue 10:00-18:00"]);
    const out = buildLocalBusiness({
      name: "Chic Studio",
      slug: "chic",
      url: `${base}/book/chic`,
      openingHoursSpecification: nh.openingHoursSpecification || [],
    });
    if (!lbPass(out)) throw new Error("Combined LB shape unexpected");
    return out;
  });

  const total = cases.length;
  const passed = cases.filter(c => c.pass).length;

  return NextResponse.json({
    ok: passed === total,
    summary: { cases: total, passed },
    cases,
    markers: ["VYAPR-9.7"],
    buildersMentioned: ["buildBreadcrumbs","buildLocalBusiness","buildFaqPage","normalizeHours"],
  }, { status: 200 });
}
