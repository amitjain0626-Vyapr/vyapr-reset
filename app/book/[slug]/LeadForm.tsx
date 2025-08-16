// app/book/[slug]/LeadForm.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

type Props = { slug: string };

export default function LeadForm({ slug }: Props) {
  const search = useSearchParams();
  const router = useRouter();

  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const utm = {
    utm_source: search.get("utm_source") || undefined,
    utm_medium: search.get("utm_medium") || undefined,
    utm_campaign: search.get("utm_campaign") || undefined,
    utm_term: search.get("utm_term") || undefined,
    utm_content: search.get("utm_content") || undefined,
    ref: typeof document !== "undefined" ? document.referrer || undefined : undefined,
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!patientName.trim()) {
      setMsg({ type: "err", text: "Please enter your name." });
      return;
    }
    if (!phone.trim()) {
      setMsg({ type: "err", text: "Please enter your phone number." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          patient_name: patientName.trim(),
          phone: phone.trim(),
          note: note.trim(),
          utm,
          website, // honeypot
        }),
      });

      if (res.status === 204) {
        // Honeypot triggered; act as success silently
        setMsg({ type: "ok", text: "Submitted." });
        setSubmitting(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create lead");
      }

      setMsg({ type: "ok", text: "Request received. The clinic will contact you shortly." });
      // Optional: redirect to a thank-you page
      setTimeout(() => router.push(`/d/${slug}?lead=1`), 900);
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Something went wrong" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {/* Honeypot field (hidden for humans) */}
      <div style={{ display: "none" }}>
        <label>
          Website
          <input
            type="text"
            name="website"
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium">Your name</label>
        <input
          className="border rounded-md px-3 py-2 outline-none"
          type="text"
          name="patient_name"
          placeholder="e.g., Riya Verma"
          required
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
        />
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium">Mobile number</label>
        <input
          className="border rounded-md px-3 py-2 outline-none"
          type="tel"
          name="phone"
          placeholder="e.g., 9876543210 or +919876543210"
          inputMode="tel"
          pattern="^(\+?\d{7,15})$|^(\d{10})$"
          title="Enter a valid phone number"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="text-xs text-gray-500">10 digits OK; we’ll auto-add +91.</p>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium">Note (optional)</label>
        <textarea
          className="border rounded-md px-3 py-2 outline-none min-h-[90px]"
          name="note"
          placeholder="Describe the issue or a preferred time…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Request appointment"}
      </button>

      {msg && (
        <p className={msg.type === "ok" ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
          {msg.text}
        </p>
      )}
    </form>
  );
}
