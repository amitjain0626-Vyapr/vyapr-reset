// components/onboarding/LanguageCard.tsx
// @ts-nocheck
"use client";

import { useState } from "react";

export default function LanguageCard({
  initial = "hinglish",
}: {
  initial?: "english" | "hinglish";
}) {
  const [lang, setLang] = useState<"english" | "hinglish">(initial as any);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/provider/lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang_pref: lang }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "save_failed");
      setMsg("Saved ✔");
    } catch (err: any) {
      setMsg(`Error: ${err.message || "failed"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-lg font-medium">Language preference</h2>
      <form onSubmit={onSave} className="mt-3 space-y-3">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="lang_pref"
            value="english"
            checked={lang === "english"}
            onChange={() => setLang("english")}
          />
          <span>English</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="lang_pref"
            value="hinglish"
            checked={lang === "hinglish"}
            onChange={() => setLang("hinglish")}
          />
          <span>Hinglish</span>
        </label>

        <button
          type="submit"
          className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save preference"}
        </button>

        {msg && (
          <div
            className={`text-sm mt-2 ${
              msg.startsWith("Error") ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {msg}
          </div>
        )}
      </form>
    </div>
  );
}
