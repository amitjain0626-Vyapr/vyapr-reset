// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BookingInstrumentation from "./BookingInstrumentation";
import BookingForm from "./form/BookingForm";
import ChooseTimeInline from "@/components/booking/ChooseTimeInline";
// INSERT: client tracker
import LandingTracker from "./LandingTracker";
// INSERT: i18n
import T from "@/components/i18n/T";
import LanguageToggle from "@/components/i18n/LanguageToggle";

// -------- helpers --------
const SITE =
  process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app";

function slugify(s?: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function unslugify(s?: string) {
  const t = String(s || "").replace(/-/g, " ").trim();
  return t.length ? t[0].toUpperCase() + t.slice(1) : "";
}
function buildWhatsAppUrl({ phone, whatsapp, display_name, slug }: any) {
  const raw = (whatsapp || phone || "").toString().replace(/[^\d+]/g, "");
  if (!raw) return "";
  // NOTE: External consumer message remains English by default (policy)
  const msg = encodeURIComponent(
    `Hi${display_name ? " " + display_name : ""}, I'd like to book a slot via Korekko (${SITE}/book/${slug}).`
  );
  return `https://wa.me/${raw.replace(/^\+/, "")}?text=${msg}`;
}
function BreadcrumbsJsonLd({
  provider,
  comboPath,
}: {
  provider: any;
  comboPath?: string;
}) {
  const items = [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: "Directory", item: `${SITE}/directory` },
  ];
  if (comboPath) {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: `${unslugify(provider?.category)} in ${unslugify(provider?.location)}`,
      item: `${SITE}${comboPath}`,
    });
    items.push({
      "@type": "ListItem",
      position: 4,
      name: provider?.display_name || provider?.slug || "Provider",
      item: `${SITE}/book/${provider?.slug || ""}`,
    });
  } else {
    items.push({
      "@type": "ListItem",
      position: 3,
      name: provider?.display_name || provider?.slug || "Provider",
      item: `${SITE}/book/${provider?.slug || ""}`,
    });
  }
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
function LocalBusinessJsonLd({ provider, waUrl }: { provider: any; waUrl: string }) {
  const sameAs: string[] = [];
  if (waUrl) sameAs.push(waUrl);
  const address = provider?.location
    ? { "@type": "PostalAddress", addressLocality: provider.location }
    : undefined;
  const data: any = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: provider?.display_name || provider?.slug || "Provider",
    description: provider?.bio || undefined,
    telephone: provider?.phone || provider?.whatsapp || undefined,
    url: `${SITE}/book/${provider?.slug || ""}`,
    address,
    sameAs: sameAs.length ? sameAs : undefined,
    image: provider?.image || undefined,
    areaServed: provider?.location || undefined,
    potentialAction: {
      "@type": "ReserveAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE}/book/${provider?.slug || ""}`,
        actionPlatform: [
          "http://schema.org/DesktopWebPlatform",
          "http://schema.org/MobileWebPlatform",
        ],
      },
      result: { "@type": "Reservation" },
    },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
function prettyCatLoc(cat?: string, loc?: string) {
  const C = (cat || "").trim(),
    L = (loc || "").trim();
  if (C && L) return `${C} — ${L}`;
  return C || L || "";
}
function fmtINR(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `₹${Math.round(v).toLocaleString("en-IN")}`;
  }
}

// ---- SEO helpers (minimal fetch for <head>) ----
async function fetchProviderMeta(slug: string) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("Providers")
      .select("display_name, bio, image, category, location")
      .eq("slug", slug)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

// OpenGraph + Twitter + Canonical
export async function generateMetadata({ params }: any): Promise<Metadata> {
  // Normalize params: accept Promise or plain object
  const p =
    params && typeof params.then === "function" ? await params : params || {};
  const slug = typeof p?.slug === "string" ? p.slug : "";

  const prov = slug ? await fetchProviderMeta(slug) : null;

  const name = (prov?.display_name || slug || "Provider").toString();
  const cat = prov?.category ? String(prov.category) : "";
  const loc = prov?.location ? String(prov.location) : "";
  const title =
    cat && loc ? `${name} — ${cat} in ${loc}` : `${name} — Book with Korekko`;
  const description =
    (prov?.bio && String(prov.bio).slice(0, 180)) ||
    (cat || loc
      ? `Book ${name} via Korekko. Services in ${[cat, loc].filter(Boolean).join(", ")}.`
      : `Book ${name} via Korekko.`);

  const url = `${SITE}/book/${slug}`;
  const images = prov?.image ? [prov.image] : [`${SITE}/og/default-provider.png`];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title,
      description,
      images,
      siteName: "Korekko",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

// -------- page (server) --------
export default async function Page(props: any) {
  // Normalize params: accept Promise or plain object
  const raw = props?.params;
  const prm = raw && typeof raw.then === "function" ? await raw : raw || {};
  const slug = typeof prm?.slug === "string" ? prm.slug : "";

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Provider
  const { data: prov } = await supabase
    .from("Providers")
    .select(
      "id, slug, display_name, bio, phone, whatsapp, category, location, published"
    )
    .eq("slug", slug)
    .maybeSingle();

  const provider = prov || { slug, display_name: slug, published: false };
  const isPublished = !!provider?.published;
  const waUrl = buildWhatsAppUrl({ ...provider, slug });

  const comboPath =
    provider?.category && provider?.location
      ? `/directory/${slugify(provider.category)}-${slugify(provider.location)}`
      : undefined;

  // Services (defensive: tolerate absence of table/columns)
  let services: Array<{
    name: string;
    price?: number;
    duration?: number;
    mode?: string;
    description?: string;
  }> = [];
  try {
    const { data: svcs, error } = await supabase
      .from("Services")
      .select(
        "name, price, duration, mode, description, provider_slug"
      )
      .eq("provider_slug", slug)
      .order("price", { ascending: true })
      .limit(30);
    if (!error && Array.isArray(svcs)) {
      services = svcs.filter((s) => s?.name);
    }
  } catch {
    // fail-open: no services
  }

  // ---- Verification status (server-side, no schema drift) ----
  let isVerified = false;
  try {
    // First try by slug (works even if provider row isn't publicly readable)
    if (slug) {
      const r2 = await fetch(
        `${SITE}/api/verification/status?slug=${encodeURIComponent(slug)}`,
        { cache: "no-store", next: { revalidate: 0 } }
      );
      const j2 = await r2.json().catch(() => null);
      if (j2 && typeof j2.verified === "boolean") {
        isVerified = !!j2.verified;
      }
    }
    // If still false and we have an id, try by provider_id too (best-effort)
    if (!isVerified && provider?.id) {
      const r = await fetch(
        `${SITE}/api/verification/status?provider_id=${encodeURIComponent(provider.id)}`,
        { cache: "no-store", next: { revalidate: 0 } }
      );
      const j = await r.json().catch(() => null);
      if (j && typeof j.verified === "boolean") {
        isVerified = !!j.verified;
      }
    }
  } catch {
    // fail-open: leave as false
  }

  const pageHref = `/book/${slug}`;
  const pageUrl = `${SITE}${pageHref}`;

  // ---- AI discovery hedge: simple stubs ----
  const showAboutStub = !provider?.bio;
  const showFaqStub = services.length === 0;

  function AboutStub() {
    const name = provider?.display_name || provider?.slug || "Provider";
    const cat = provider?.category ? provider.category : "local services";
    const city = provider?.location ? provider.location : "your city";
    return (
      <section className="mb-8" id="about">
        <h2 className="text-base font-semibold">
          <T en="About" hi="About" />
        </h2>
        <p className="mt-1 text-gray-700">
          <T
            en={`${name} offers ${cat} in ${city}. Book convenient appointments online via Korekko. We’ll confirm your slot and send reminders on WhatsApp.`}
            hi={`${name} ${city} mein ${cat} provide karte hain. Korekko par online booking karein. Hum aapka slot confirm karke WhatsApp par reminders bhejenge.`}
          />
        </p>
        <div className="mt-2 text-[11px] text-gray-500">
          <T en="Korekko auto-generated" hi="Korekko auto-generated" />
        </div>
      </section>
    );
  }

  function FaqStub() {
    const name = provider?.display_name || provider?.slug || "the provider";
    const cat = provider?.category ? provider.category : "services";
    const city = provider?.location ? provider.location : "your area";
    return (
      <section className="mb-8" id="faqs">
        <h2 className="text-base font-semibold">
          <T en="FAQs" hi="FAQs" />
        </h2>
        <div className="mt-2 space-y-3">
          <div>
            <div className="font-medium text-sm">
              <T en="What services are offered?" hi="Kaun-kaun si services milengi?" />
            </div>
            <p className="text-sm text-gray-700">
              <T
                en={`${name} provides ${cat}. If you don’t see a list yet, pick a time and share your need in the note.`}
                hi={`${name} ${cat} provide karte hain. Agar list nahi dikh rahi, to koi time choose karke note mein apni requirement likh dein.`}
              />
            </p>
          </div>
          <div>
            <div className="font-medium text-sm">
              <T en="How do I book?" hi="Booking kaise hogi?" />
            </div>
            <p className="text-sm text-gray-700">
              <T
                en="Choose a slot below and confirm. You’ll get WhatsApp updates. You can also chat on WhatsApp first."
                hi="Neeche slot choose karke confirm karen. WhatsApp par updates mil jayenge. Chahein to pehle WhatsApp par chat bhi kar sakte hain."
              />
            </p>
          </div>
          <div>
            <div className="font-medium text-sm">
              <T en="Where are appointments held?" hi="Appointment kahan hota hai?" />
            </div>
            <p className="text-sm text-gray-700">
              <T
                en={`Appointments are typically in ${city} or online (Google Meet). You can request phone or in-person during booking.`}
                hi={`Appointments aam taur par ${city} mein ya online (Google Meet) hote hain. Booking ke waqt phone ya in-person option bhi choose kar sakte hain.`}
              />
            </p>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-gray-500">
          <T en="Korekko auto-generated" hi="Korekko auto-generated" />
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Lang toggle (client) */}
      <div className="flex items-center justify-end mb-4">
        <LanguageToggle />
      </div>

      {/* INSERT: logs landing from WA/template links with providerId */}
      <LandingTracker slug={slug} providerId={provider?.id || null} />

      <BookingInstrumentation providerId={provider?.id || null} />

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="text-sm mb-6">
        <ol className="flex gap-2 text-gray-600">
          <li>
            <Link className="hover:underline" href="/">
              <T en="Home" hi="Home" />
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link className="hover:underline" href="/directory">
              <T en="Directory" hi="Directory" />
            </Link>
          </li>
          {comboPath ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link className="hover:underline" href={comboPath}>
                  {unslugify(slugify(provider.category))} <T en="in" hi="in" />{" "}
                  {unslugify(slugify(provider.location))}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li className="text-gray-800 font-medium">
            {provider?.display_name || provider?.slug}
          </li>
        </ol>
      </nav>

      {/* Back to combo */}
      {comboPath ? (
        <div className="mb-4">
          <a href={comboPath} className="text-sm underline">
            ← <T en="Back to" hi="Wapas" /> {provider.category} <T en="in" hi="in" /> {provider.location}
          </a>
        </div>
      ) : null}

      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-semibold">
          {provider?.display_name || provider?.slug}
        </h1>
        <p className="text-gray-600 mt-1">
          {prettyCatLoc(provider?.category, provider?.location)}
        </p>

        {/* Trust marker when published */}
        {isPublished ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-600/70 bg-emerald-50 px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-[12px] font-medium text-emerald-800">
              <T en="Verified by Korekko" hi="Verified by Korekko" />
            </span>
            {/* Server-visible text for curl/grep without changing UI */}
            <span className="sr-only">Verified by Korekko</span>
          </div>
        ) : null}

        {/* Also show verified badge for unpublished-but-verified profiles */}
        {!isPublished && isVerified ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-600/70 bg-emerald-50 px-3 py-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-[12px] font-medium text-emerald-800">
              <T en="Verified by Korekko" hi="Verified by Korekko" />
            </span>
            {/* Server-visible text for curl/grep without changing UI */}
            <span className="sr-only">Verified by Korekko</span>
          </div>
        ) : null}

        {!isPublished ? (
          <p className="mt-3 text-sm text-amber-700">
            <T en="Preview is blurred. Publish to go live." hi="Preview blurred hai. Publish karke live karein." />
          </p>
        ) : null}
      </header>

      {/* CTAs */}
      <section className="flex flex-wrap gap-3 mb-8">
        <a
          href={waUrl || "#"}
          aria-disabled={!waUrl}
          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm ${
            waUrl
              ? "border-emerald-600 hover:shadow-sm"
              : "border-gray-300 opacity-50 cursor-not-allowed"
          }`}
          {...(waUrl ? { target: "_blank", rel: "noopener" } : {})}
        >
          <T en="Chat on WhatsApp" hi="WhatsApp par baat karein" />
        </a>
        <a
          id="Korekko-book-now"
          href="#booking"
          className="inline-flex items-center rounded-full border px-4 py-2 text-sm border-gray-800 hover:shadow-sm"
        >
          <T en="Book now" hi="Abhi book karein" />
        </a>
      </section>

      {/* About */}
      {provider?.bio ? (
        <section className="mb-8" id="about">
          <h2 className="text-base font-semibold">
            <T en="About" hi="About" />
          </h2>
          <p className="mt-1 text-gray-700 whitespace-pre-line">{provider.bio}</p>
        </section>
      ) : null}

      {/* About (AI stub) */}
      {showAboutStub ? <AboutStub /> : null}

      {/* Services (renders only if we found any) */}
      {services.length ? (
        <section className="mb-8" id="services">
          <h2 className="text-base font-semibold">
            <T en="Services" hi="Services" />
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {services.map((s, idx) => (
              <div key={idx} className="rounded-2xl border p-4 bg-white">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {s.mode ? s.mode : ""}
                  {s.mode && s.duration ? " • " : ""}
                  {s.duration ? <T en={`${s.duration} min`} hi={`${s.duration} min`} /> : ""}
                </div>
                {Number.isFinite(Number(s.price)) ? (
                  <div className="mt-2 text-lg font-semibold">{fmtINR(s.price)}</div>
                ) : null}
                {s.description ? (
                  <p className="mt-2 text-xs text-gray-600 whitespace-pre-line">
                    {s.description}
                  </p>
                ) : null}
                <a href="#booking" className="mt-3 inline-flex text-sm text-indigo-700 underline">
                  <T en="Book this" hi="Ye book karein" />
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Services empty-state (shown when there are zero services) */}
      {!services.length ? (
        <section className="mb-8" id="services-empty">
          <div className="rounded-2xl border border-dashed p-5 bg-white">
            <h2 className="text-base font-semibold">
              <T en="Services" hi="Services" />
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              <T
                en="No services listed yet. Add your offerings to help customers pick faster."
                hi="Abhi services list nahi hain. Apni offerings add karein taki customers jaldi choose kar sakein."
              />
            </p>
            <a
              href="/dashboard/services/add"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-indigo-600 px-4 py-2 text-indigo-700 bg-white hover:bg-indigo-50 transition"
            >
              <T en="➕ Add your first service" hi="➕ Pehli service add karein" />
            </a>
          </div>
        </section>
      ) : null}

      {/* FAQs (AI stub shown only when no services yet) */}
      {showFaqStub ? <FaqStub /> : null}

      {/* Contact */}
      <section className="mb-8" id="contact">
        <h2 className="text-base font-semibold">
          <T en="Contact" hi="Sampark" />
        </h2>
        <ul className="mt-2 text-gray-700 text-sm space-y-1">
          {provider?.phone ? (
            <li>
              <T en="Phone" hi="Phone" />:{" "}
              <a
                className="underline"
                href={`tel:${String(provider.phone).replace(/\s+/g, "")}`}
              >
                {provider.phone}
              </a>
            </li>
          ) : null}
          {provider?.whatsapp ? (
            <li>
              <T en="WhatsApp" hi="WhatsApp" />:{" "}
              <a className="underline" href={waUrl} target="_blank" rel="noopener">
                <T en="Chat now" hi="Abhi chat karein" />
              </a>
            </li>
          ) : null}
          <li>
            <T en="Digital Card" hi="Digital Card" />:{" "}
            <Link className="underline" href={`/card/${slug}`} prefetch={false}>
              <T en="Open" hi="Open" />
            </Link>
          </li>
        </ul>
      </section>

      {/* NEW: calendar-style time picker (client) */}
      <section id="booking" className="mb-8">
        <ChooseTimeInline slug={slug} />
      </section>

      {/* Existing Booking Form (unchanged) */}
      <section className="mb-12">
        <BookingForm
          slug={slug}
          providerName={provider?.display_name || provider?.slug}
          pageHref={pageHref}
          phone={provider?.phone}
          whatsapp={provider?.whatsapp}
          pageUrl={pageUrl}
        />
      </section>

      {/* JSON-LD */}
      <BreadcrumbsJsonLd provider={provider} comboPath={comboPath} />
      <LocalBusinessJsonLd provider={provider} waUrl={waUrl} />
    </main>
  );
}
