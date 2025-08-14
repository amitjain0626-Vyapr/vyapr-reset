"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Payload = {
  name: string;
  phone: string;
  category: string;
  slug: string;
  city?: string;
  about?: string;
  priceRange?: string;
};

export default function Page() {
  const router = useRouter();
  const [form, setForm] = useState<Payload>({ name: "", phone: "", category: "", slug: "" });
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [errMeta, setErrMeta] = useState<any>(null);

  const onChange =
    (k: keyof Payload) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
    };

  async function onPublish() {
    setLoading(true);
    setErrMsg(null);
    setErrMeta(null);

    const required: (keyof Payload)[] = ["name", "phone", "category", "slug"];
    for (const k of required) {
      if (!form[k] || String(form[k]).trim() === "") {
        setErrMsg(`Missing field: ${k}`);
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/dentists/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json?.ok) {
        const message =
          json?.error?.message ||
          json?.error ||
          (typeof json === "string" ? json : "") ||
          `Publish failed (${res.status}).`;
        setErrMsg(message);
        setErrMeta(json?.meta || null);
        setLoading(false);
        return;
      }

      router.push(json.redirect || `/dashboard?slug=${json.slug}`);
    } catch (e: any) {
      setErrMsg(e?.message || "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Publish Your Profile</h1>
      <div className="grid gap-3">
        <input className="border rounded-xl px-3 py-2" placeholder="Name" value={form.name} onChange={onChange("name")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Phone (+91…)" value={form.phone} onChange={onChange("phone")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Category" value={form.category} onChange={onChange("category")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Slug (e.g., dr-kapoor)" value={form.slug} onChange={onChange("slug")} />
        <input className="border rounded-xl px-3 py-2" placeholder="City (optional)" value={form.city ?? ""} onChange={onChange("city")} />
        <textarea className="border rounded-xl px-3 py-2" placeholder="About (optional)" value={form.about ?? ""} onChange={onChange("about")} />
        <input className="border rounded-xl px-3 py-2" placeholder="Price range (optional)" value={form.priceRange ?? ""} onChange={onChange("priceRange")} />
      </div>

      <div className="space-y-2">
        <button onClick={onPublish} disabled={loading} className="rounded-2xl px-4 py-2 bg-black text-white disabled:opacity-70">
          {loading ? "Publishing…" : "Publish"}
        </button>

        {errMsg && (
          <div className="text-sm text-red-700 border border-red-200 rounded-md p-3 bg-red-50 whitespace-pre-wrap">
            <div className="font-medium">{errMsg}</div>
            {errMeta ? <pre className="mt-2 text-xs overflow-x-auto">{JSON.stringify(errMeta, null, 2)}</pre> : null}
          </div>
        )}
      </div>
    </div>
  );
}
