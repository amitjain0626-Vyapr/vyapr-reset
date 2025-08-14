// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { TIER1_CATEGORIES } from "@/lib/constants/categories";
import { slugify } from "@/lib/utils/slugify";

export default function OnboardingPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("");
  const [baselineRevenue, setBaselineRevenue] = useState("");

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const slug = slugify(name || phone || crypto.randomUUID());
    const { data, error } = await supabase
      .from("providers")
      .insert([
        {
          name,
          phone,
          category_slug: category,
          baseline_revenue: baselineRevenue ? Number(baselineRevenue) : null,
          slug,
          published: false,
        },
      ])
      .select("slug")
      .single();

    if (error) {
      console.error(error);
      alert("Could not create profile. Try another phone or name.");
      return;
    }

    router.push(`/d/${data.slug}?preview=1`);
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Create your Vyapr microsite</h1>
      <p className="text-sm text-gray-600 mb-6">
        Name, phone, category → instant site with blurred preview.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Your name (public)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-3 rounded"
          required
        />
        <input
          type="tel"
          placeholder="Phone (WhatsApp)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border p-3 rounded"
          required
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border p-3 rounded"
          required
        >
          <option value="">Select category</option>
          {TIER1_CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          min="0"
          placeholder="Monthly revenue baseline (₹) — optional"
          value={baselineRevenue}
          onChange={(e) => setBaselineRevenue(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <button
          type="submit"
          className="bg-teal-600 text-white px-4 py-2 rounded w-full"
        >
          Generate microsite (preview)
        </button>
      </form>
    </div>
  );
}
