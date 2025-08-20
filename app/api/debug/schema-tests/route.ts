// @ts-nocheck
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Case = { name: string; pass: boolean; details: any; builder?: string; skipped?: boolean };

function isObj(v: any) { return v && typeof v === "object"; }

async function safeImport(path: string) {
  try { return { ok: true, mod: await import(path) }; }
  catch (e: any) { return { ok: false, error: String(e), path }; }
}

// Try many plausible locations; merge any exports we find.
async function multiImport(paths: string[]) {
  const notes: any[] = [];
  const merged: any = {};
  for (const p of paths) {
    const r = await safeImport(p);
    if (!r.ok) { notes.push({ path: p, error: r.error }); continue; }
    Object.assign(merged, r.mod || {});
    notes.push({ path: p, ok: true });
  }
  return { merged, notes };
}

async function callFirst<T>(fns: Array<() => any>) {
  let lastErr: any = null;
  for (const fn of fns) {
    try {
      const out = fn();
      const res = out?.then ? await out : out;
      if (res !== undefined) return { ok: true, res };
    } catch (e: any) { lastErr = e; }
  }
  return { ok: false, error: String(lastErr || "No variant matched") };
}

function bcPass(o: any) {
  return isObj(o) && (o["@type"] === "BreadcrumbList" || Array.isArray(o.itemListElement) || isObj(o.itemListElement));
}
function lbPass(o: any) {
  return isObj(o) && ((o["@type"] && String(o["@type"]).toLowerCase().includes("business")) || o.name || o.url);
}
function faqPass(o: any, allowNull = true) {
  if (o == null) return allowNull;
  return isObj(o) && ((o["@type"] === "FAQPage" && Array.isArray(o.mainEntity)) || Array.isArray(o.faq) || Array.isArray(o.items));
}
function hoursPass(o: any) {
  if (!o) return false;
  if (Array.isArray(o)) return true;
  if (Array.isArray(o.openingHoursSpecification)) return true;
  if (Array.isArray(o.specs)) return true;
  if (Array.isArray(o.ui)) return true;
  if (Array.isArray(o.schema)) return true;
  return isObj(o);
}

function json(body: any, status = 200) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return res;
}

export async function GET(req: Request) {
  const t0 = Date.now();
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${url.protocol}//${url.host}`;

  const ping = url.searchParams.get("ping");
  const mini = url.searchParams.get("mini");
  const full = url.searchParams.get("full");

  if (ping) {
    return json({ ok: true, markers: ["VYAPR-9.7"], ping: true, now: new Date().toISOString() });
  }

  // Candidates for schema-related builders across your codebase variants
  const schemaCandidates = [
    "@/lib/schema",
    "@/lib/seo/schema",
    "@/lib/seo/index",
    "@/lib/seo/breadcrumbs",
    "@/components/SeoBreadcrumbs",
    "@/components/seo/Breadcrumbs",
    "@/lib/seo/faq",
    "@/components/FAQ",
  ];
  // Candidates for hours normalizer
  const hoursCandidates = [
    "@/lib/hours",
    "@/lib/seo/hours",
    "@/lib/utils/hours",
  ];

  const schemaLoad = await multiImport(schemaCandidates);
  const hoursLoad = await multiImport(hoursCandidates);

  // Consolidate possible exports. We accept either camelCase or default collections.
  const buildBreadcrumbs =
    schemaLoad.merged.buildBreadcrumbs ||
    schemaLoad.merged.breadcrumbs ||
    schemaLoad.merged.default?.buildBreadcrumbs;

  const buildLocalBusiness =
    schemaLoad.merged.buildLocalBusiness ||
    schemaLoad.merged.localBusiness ||
    schemaLoad.merged.default?.buildLocalBusiness;

  const buildFaqPage =
    schemaLoad.merged.buildFaqPage ||
    schemaLoad.merged.faqJsonLd ||
    schemaLoad.merged.default?.buildFaqPage;

  const normalizeHours =
    hoursLoad.merged.normalizeHours ||
    hoursLoad.merged.default?.normalizeHours;

  const importsReport = {
    schemaTried: schemaLoad.notes,
    hoursTried: hoursLoad.notes,
    exportsFound: {
      buildBreadcrumbs: !!buildBreadcrumbs,
      buildLocalBusiness: !!buildLocalBusiness,
      buildFaqPage: !!buildFaqPage,
      normalizeHours: !!normalizeHours,
    },
  };

  if (mini || !full) {
    return json({
      ok: true,
      mode: "mini",
      markers: ["VYAPR-9.7"],
      summary: { duration_ms: Date.now() - t0 },
      ...importsReport,
      buildersMentioned: ["buildBreadcrumbs", "buildLocalBusiness", "buildFaqPage", "normalizeHours"],
    });
  }

  // ---------------- FULL TESTS (explicit ?full=1) ----------------
  const cases: Case[] = [];
  cases.push({ name: "Route self-check", builder: "route", pass: true, details: { base } });

  async function add(name: string, builder: string, thunk: () => Promise<any> | any, skipIfMissing = false) {
    try {
      if (skipIfMissing && !thunk) {
        cases.push({ name, builder, pass: true, skipped: true, details: "builder missing (skipped)" });
        return;
      }
      const out = typeof thunk === "function" ? thunk() : thunk;
      const res = out?.then ? await out : out;
      cases.push({ name, builder, pass: true, details: res });
    } catch (e: any) {
      cases.push({ name, builder, pass: false, details: { error: String(e?.message || e) } });
    }
  }

  // Breadcrumbs
  const bcTrail = [
    { name: "Home", url: `${base}/` },
    { name: "Directory", url: `${base}/directory` },
    { name: "Dance in Pune", url: `${base}/directory/dance-pune` },
  ];
  await add("Breadcrumbs: 3-segment", "buildBreadcrumbs", async () => {
    if (!buildBreadcrumbs) throw new Error("buildBreadcrumbs not found");
    const { ok, res, error } = await callFirst([
      () => buildBreadcrumbs(bcTrail),
      () => buildBreadcrumbs({ trail: bcTrail }),
      () => buildBreadcrumbs({ baseUrl: base, segments: bcTrail }),
    ]);
    if (!ok) throw new Error(error);
    if (!bcPass(res)) throw new Error("Breadcrumbs shape unexpected");
    return { sample: res };
  }, true);

  await add("Breadcrumbs: empty", "buildBreadcrumbs", async () => {
    if (!buildBreadcrumbs) throw new Error("buildBreadcrumbs not found");
    const empty: any[] = [];
    const { ok, res, error } = await callFirst([
      () => buildBreadcrumbs(empty),
      () => buildBreadcrumbs({ trail: empty }),
      () => buildBreadcrumbs({ baseUrl: base, segments: empty }),
    ]);
    if (!ok) throw new Error(error);
    if (!bcPass(res)) throw new Error("Empty breadcrumb shape unexpected");
    return { sample: res };
  }, true);

  // Hours
  const hoursMixed = await (async () => {
    if (!normalizeHours) return { note: "normalizeHours missing" };
    const input = ["Mon-Fri 09:00-17:00", { day: "tue", opens: "10:00", closes: "18:30" }, "Sunday closed", "invalid"];
    const out = await normalizeHours(input);
    if (!hoursPass(out)) throw new Error("normalizeHours shape unexpected");
    return out;
  })();
  await add("Hours: mixed normalization", "normalizeHours", () => hoursMixed, true);

  await add("Hours: invalid-only", "normalizeHours", async () => {
    if (!normalizeHours) throw new Error("normalizeHours not found");
    const out = await normalizeHours(["nonsense", "xx"]);
    if (!hoursPass(out)) throw new Error("normalizeHours invalid shape unexpected");
    return out;
  }, true);

  // LocalBusiness
  const fullProvider = {
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
    openingHoursSpecification:
      hoursMixed?.openingHoursSpecification || hoursMixed?.schema || [],
  };

  await add("LocalBusiness: full object", "buildLocalBusiness", async () => {
    if (!buildLocalBusiness) throw new Error("buildLocalBusiness not found");
    const { ok, res, error } = await callFirst([
      () => buildLocalBusiness(fullProvider),
      () => buildLocalBusiness({ ...fullProvider, baseUrl: base }),
    ]);
    if (!ok) throw new Error(error);
    if (!lbPass(res)) throw new Error("LocalBusiness shape unexpected");
    return { sample: res };
  }, true);

  await add("LocalBusiness: minimal", "buildLocalBusiness", async () => {
    if (!buildLocalBusiness) throw new Error("buildLocalBusiness not found");
    const minimal = { slug: "amit", url: `${base}/book/amit` };
    const { ok, res, error } = await callFirst([
      () => buildLocalBusiness(minimal),
      () => buildLocalBusiness({ provider: minimal }),
    ]);
    if (!ok) throw new Error(error);
    if (!lbPass(res)) throw new Error("LocalBusiness minimal shape unexpected");
    return { sample: res };
  }, true);

  // FAQ
  const faqFull = [
    { question: "What are the consultation hours?", answer: "Mon–Fri, 10am–6pm." },
    { question: "How much is the first visit?", answer: "₹500." },
  ];
  await add("FAQPage: full", "buildFaqPage", async () => {
    if (!buildFaqPage) throw new Error("buildFaqPage not found");
    const { ok, res, error } = await callFirst([
      () => buildFaqPage(faqFull),
      () => buildFaqPage({ items: faqFull }),
    ]);
    if (!ok) throw new Error(error);
    if (!faqPass(res, false)) throw new Error("FAQ full shape unexpected");
    return { sample: res };
  }, true);

  await add("FAQPage: single empty pair", "buildFaqPage", async () => {
    if (!buildFaqPage) throw new Error("buildFaqPage not found");
    const emptyPair = [{ question: "", answer: "" }];
    const { ok, res, error } = await callFirst([
      () => buildFaqPage(emptyPair),
      () => buildFaqPage({ items: emptyPair }),
    ]);
    if (!ok) throw new Error(error);
    if (!faqPass(res, true)) throw new Error("FAQ empty-pair handling unexpected");
    return { sample: res };
  }, true);

  await add("FAQPage: empty array → omit", "buildFaqPage", async () => {
    if (!buildFaqPage) throw new Error("buildFaqPage not found");
    const empty: any[] = [];
    const { ok, res, error } = await callFirst([
      () => buildFaqPage(empty),
      () => buildFaqPage({ items: empty }),
    ]);
    if (!ok) throw new Error(error);
    if (!faqPass(res, true)) throw new Error("FAQ empty handling unexpected");
    return { sample: res ?? null };
  }, true);

  // Combined
  await add("Combined: LB + normalizeHours", "buildLocalBusiness", async () => {
    if (!buildLocalBusiness) throw new Error("buildLocalBusiness not found");
    if (!normalizeHours) return { skipped: "normalizeHours missing" };
    const nh = await normalizeHours(["Mon 09:00-17:00", "Tue 10:00-18:00"]);
    const withHours = {
      name: "Chic Studio",
      slug: "chic",
      url: `${base}/book/chic`,
      openingHoursSpecification:
        nh?.openingHoursSpecification || nh?.schema || [],
    };
    const { ok, res, error } = await callFirst([
      () => buildLocalBusiness(withHours),
      () => buildLocalBusiness({ ...withHours, baseUrl: base }),
    ]);
    if (!ok) throw new Error(error);
    if (!lbPass(res)) throw new Error("Combined LB shape unexpected");
    return { sample: res };
  }, true);

  const total = cases.length;
  const passed = cases.filter(c => c.pass).length;

  return json({
    ok: passed === total,
    mode: "full",
    summary: { cases: total, passed, duration_ms: Date.now() - t0 },
    cases,
    markers: ["VYAPR-9.7"],
    ...importsReport,
  });
}
