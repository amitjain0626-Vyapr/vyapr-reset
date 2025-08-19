// lib/seo/faq.ts
// Battle-tested FAQ generator for directory pages.
// Produces visible Q&A and valid FAQPage JSON-LD.

export type FaqItem = { question: string; answer: string };

type GenerateOpts = {
  category: string;   // e.g., "yoga", "dentist", "physiotherapist"
  city: string;       // e.g., "delhi"
  providerCount?: number; // optional hint
  acceptsWalkIns?: boolean; // optional hint
};

const TITLE_CASE_EXCEPTIONS = new Set(["of", "in", "and", "or", "for", "at", "on"]);

export function toTitle(str: string) {
  const clean = (str || "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return clean
    .split(" ")
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && TITLE_CASE_EXCEPTIONS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function humanizeCategory(cat: string) {
  const c = cat.toLowerCase();
  const map: Record<string, string> = {
    yoga: "Yoga",
    dentist: "Dentist",
    dentists: "Dentist",
    physiotherapist: "Physiotherapist",
    physiotherapy: "Physiotherapist",
    dermatologist: "Dermatologist",
    nutritionist: "Nutritionist",
    tutor: "Tutor",
    teacher: "Teacher",
  };
  return map[c] || toTitle(c);
}

function cityLabel(city: string) {
  return toTitle(city);
}

function genericFaqs(category: string, city: string, hints: GenerateOpts): FaqItem[] {
  const cat = humanizeCategory(category);
  const place = cityLabel(city);
  const countText =
    hints.providerCount && hints.providerCount > 0
      ? ` We currently list around ${hints.providerCount} ${cat.toLowerCase()} option(s) in ${place}.`
      : "";

  return [
    {
      question: `How do I find the best ${cat.toLowerCase()} in ${place}?`,
      answer:
        `Compare profiles on this page for experience, reviews, location, and pricing.${countText} ` +
        `Use the WhatsApp or “Book now” button to confirm availability and share your requirement.`,
    },
    {
      question: `What are typical fees for a ${cat.toLowerCase()} in ${place}?`,
      answer:
        `Fees vary by experience, specialization, and location within ${place}. ` +
        `Ask for a final quote on WhatsApp before booking; many providers offer first-session/consult discounts.`,
    },
    {
      question: `Can I book ${cat.toLowerCase()} appointments online in ${place}?`,
      answer:
        `Yes. Use the “Book now” form or WhatsApp CTA on each profile. You’ll receive a confirmation and any pre-visit instructions directly from the provider.`,
    },
    {
      question: `Do ${cat.toLowerCase()} providers in ${place} offer home visits or online sessions?`,
      answer:
        `Some do. Check the profile highlights or ask on WhatsApp for home/online session options, availability, and pricing.`,
    },
    {
      question: `What documents or prep do I need before my ${cat.toLowerCase()} session in ${place}?`,
      answer:
        `Carry an ID and any relevant medical history/previous reports (if applicable). Wear comfortable clothing if movement is expected, and arrive 10 minutes early.`,
    },
    {
      question: `How are cancellations and rescheduling handled?`,
      answer:
        `Policies vary by provider. Most accept reschedules on WhatsApp if informed in advance. Same‑day cancellations may attract a fee.`,
    },
  ];
}

function categorySpecificFaqs(category: string, city: string): FaqItem[] {
  const cat = category.toLowerCase();
  const place = cityLabel(city);

  if (cat === "dentist" || cat === "dentists") {
    return [
      {
        question: `Which dental treatments are most common in ${place}?`,
        answer:
          `Consultations, scaling/cleaning, fillings, root canal, crowns, aligners, and teeth whitening are common. Exact plan is decided after a chairside exam.`,
      },
      {
        question: `How long does a root canal typically take in ${place}?`,
        answer:
          `Usually 1–2 sittings depending on complexity. Your dentist will advise timelines after X‑rays and evaluation.`,
      },
    ];
  }

  if (cat === "physiotherapist" || cat === "physiotherapy") {
    return [
      {
        question: `What conditions do physiotherapists commonly treat in ${place}?`,
        answer:
          `Back/neck pain, sports injuries, post‑operative rehab, arthritis, and posture issues. Treatment plans are personalized after assessment.`,
      },
      {
        question: `How many physio sessions will I need?`,
        answer:
          `Depends on the diagnosis and response. Most plans review progress every 3–5 sessions and adjust frequency.`,
      },
    ];
  }

  if (cat === "dermatologist") {
    return [
      {
        question: `What skin concerns do dermatologists commonly treat in ${place}?`,
        answer:
          `Acne, pigmentation, hair fall, eczema, fungal infections, and cosmetic procedures (peels, lasers, Botox). Your regimen is customized post consult.`,
      },
      {
        question: `Are cosmetic dermatology procedures safe?`,
        answer:
          `When done by qualified doctors with proper indications, yes. Ask about device brand, consumables, after‑care, and potential downtime.`,
      },
    ];
  }

  if (cat === "nutritionist") {
    return [
      {
        question: `Can a nutritionist help with weight loss and medical diets in ${place}?`,
        answer:
          `Yes — from weight management to PCOS, diabetes, and thyroid support. Expect a plan based on lifestyle, labs, and preferences.`,
      },
      {
        question: `How often are follow‑ups needed?`,
        answer:
          `Typically weekly/bi‑weekly initially, then monthly once stable. Many offer virtual check‑ins on WhatsApp.`,
      },
    ];
  }

  if (cat === "yoga") {
    return [
      {
        question: `What types of yoga classes are popular in ${place}?`,
        answer:
          `Hatha, Vinyasa, Ashtanga, Prenatal, Therapeutic, and Beginner flows are common. Choose based on goals and fitness level.`,
      },
      {
        question: `Do studios offer trial classes in ${place}?`,
        answer:
          `Many do. Ask on WhatsApp for a trial/drop‑in option before purchasing a pack.`,
      },
    ];
  }

  // Fallback
  return [];
}

export function generateDirectoryFaq(opts: GenerateOpts): FaqItem[] {
  const { category, city } = opts;
  const base = genericFaqs(category, city, opts);
  const specific = categorySpecificFaqs(category, city);
  const merged = [...specific, ...base].slice(0, 8);

  const seen = new Set<string>();
  return merged.filter((q) => {
    const key = q.question.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function faqJsonLd(items: FaqItem[]) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: it.answer,
      },
    })),
  };
  return JSON.stringify(payload);
}
