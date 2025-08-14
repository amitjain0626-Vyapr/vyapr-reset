// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  name: string;
  phone: string;
  city?: string;
  category: string;
  about?: string;
  address1?: string;
  address2?: string;
  website?: string;
  gmaps?: string;
  profileImageUrl?: string;
  coverImageUrl?: string;
  services?: string; // comma/JSON (free text for now)
  slug?: string;     // optional — auto from name if blank
  published?: boolean;
};

function toMsg(x: unknown): string {
  try {
    if (!x) return "Unknown error";
    if (typeof x === "string") return x;
    if (x instanceof Error) return x.message || String(x);
    return JSON.stringify(x, null, 2);
  } catch {
    return "Unexpected error";
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    phone: "",
    city: "",
    category: "",
    about: "",
    address1: "",
    address2: "",
    website: "",
    gmaps: "",
    profileImageUrl: "",
    coverImageUrl: "",
    services: "",
    slug: "",
    published: true,
  });

  const [loading, setLoading] = useState(false);
  const [errText, setErrText] = useState<string | null>(null);

  // auto-slug from name if user hasn’t typed a slug
  const autoSlug = useMemo(() => {
    const base = (form.name || "").trim().toLowerCase();
    return base
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);
  }, [form.name]);

  const finalSlug = (form.slug || autoSlug || "").trim();

  const onChange =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.currentTarget.type === "checkbox"
        ? (e as any).currentTarget.checked
        : e.currentTarget.value;
      setForm((f) => ({ ...f, [k]: v as any }));
    };

  async function onPublish() {
    setLoading(true);
    setErrText(null);

    // Minimal client-side validation
    const required: (keyof FormState)[] = ["name", "phone", "category"];
    for (const k of required) {
      if (!form[k] || String(form[k]).trim() === "") {
        setErrText(`Missing field: ${k}`);
        setLoading(false);
        return;
      }
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      category: form.category.trim(),
      slug: finalSlug || undefined,
      // Optional fields can be sent later when API supports them
      city: form.city?.trim() || undefined,
      about: form.about?.trim() || undefined,
      // keep the payload lean to avoid column-mismatch 400s
    };

    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // ensure Supabase session cookies are sent
        body: JSON.stringify(payload),
      });

      // Try to parse JSON response; if not JSON, show status
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      if (!res.ok || !json?.ok) {
        const message =
          json?.error?.message ||
          json?.message ||
          json?.error ||
          toMsg(json?.meta) ||
          `Publish failed (${res.status})`;

        setErrText(message);
        setLoading(false);
        return;
      }

      router.push(json.redirect || `/dashboard?slug=${json.slug}`);
    } catch (e: any) {
      setErrText(toMsg(e));
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Create your Vyapr microsite</h1>
      <p className="text-sm text-gray-600">
        Name, phone, category → instant site with blurred preview.
      </p>

      {/* Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={onChange("name")}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Phone (+91...)"
          value={form.phone}
          onChange={onChange("phone")}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="City"
          value={form.city || ""}
          onChange={onChange("city")}
        />
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Category (e.g., Dentist, Yoga Teacher)"
          value={form.category}
          onChange={onChange("category")}
        />
        <textarea
          className="md:col-span-2 border rounded-xl px-3 py-2 min-h-[90px]"
          placeholder="About"
          value={form.about || ""}
          onChange={onChange("about")}
        />

        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Slug (optional)"
          value={form.slug || ""}
          onChange={onChange("slug")}
        />
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Final link will be</span>
          <code className="px-2 py-1 bg-gray-100 rounded">/d/{finalSlug || "your-name"}</code>
        </div>

        <label className="flex items-center gap-2 md:col-span-2 text-sm">
          <input
            type="checkbox"
            checked={!!form.published}
            onChange={onChange("published")}
          />
          <span>Published</span>
        </label>
      </div>

      <div className="space-y-3">
        <button
          onClick={onPublish}
          disabled={loading}
          className="rounded-2xl px-4 py-2 bg-black text-white disabled:opacity-70"
        >
          {loading ? "Publishing…" : "Publish"}
        </button>

        {errText && (
          <div className="text-sm text-red-700 border border-red-200 rounded-md p-3 bg-red-50 whitespace-pre-wrap">
            {errText}
          </div>
        )}
      </div>
    </div>
  );
}
