// components/reviews/ReplyTemplates.tsx
// @ts-nocheck
"use client";

import * as React from "react";

type Props = {
  slug: string;
  providerId?: string | null;
  providerName?: string | null;
  lang?: "en" | "hi";
  tone?: "formal" | "casual";
};

const enc = (s: string) => encodeURIComponent(s);

export default function ReplyTemplates({
  slug,
  providerId = null,
  providerName = "",
  lang = "en",
  tone = "casual",
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [text, setText] = React.useState("");
  const [selected, setSelected] = React.useState<{ lang: "en" | "hi"; tone: "formal" | "casual" } | null>(null);

  async function log(event: string, extra?: any) {
    try {
      await fetch("/api/events/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          ts: Date.now(),
          provider_id: providerId || null,
          lead_id: null,
          source: { via: "orm.reply", slug, ...extra },
        }),
      });
    } catch {}
  }

  async function preview(nextLang: "en" | "hi", nextTone: "formal" | "casual") {
    setBusy(true);
    try {
      const qs = new URLSearchParams({ slug, lang: nextLang, tone: nextTone, provider: providerName || "" });
      const res = await fetch(`/api/reviews/reply/preview?${qs.toString()}`, { cache: "no-store" });
      const j = await res.json();
      const picked =
        (j?.preview?.[nextLang]?.[nextTone]) ||
        (typeof j?.text === "string" ? j.text : "");
      setText(picked || "");
      setSelected({ lang: nextLang, tone: nextTone });
      await log("review.reply.previewed", { lang: nextLang, tone: nextTone });
    } finally {
      setBusy(false);
    }
  }

  async function copyToClipboard() {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    await log("review.reply.copied", selected || {});
    alert("Copied reply template.");
  }

  async function openWhatsapp() {
    if (!text) return;
    await log("review.reply.sent", { mode: "whatsapp", ...(selected || {}) });
    const url = `https://api.whatsapp.com/send?text=${enc(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Reply Templates • ORM Lite</h3>
        <span className="text-xs text-gray-500">review replies</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => preview("en", "casual")}
          disabled={busy}
        >
          EN • Casual
        </button>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => preview("en", "formal")}
          disabled={busy}
        >
          EN • Formal
        </button>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => preview("hi", "casual")}
          disabled={busy}
        >
          HI • Casual
        </button>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={() => preview("hi", "formal")}
          disabled={busy}
        >
          HI • Formal
        </button>
      </div>

      <textarea
        readOnly
        value={text}
        placeholder="Pick a template above to preview…"
        className="w-full h-40 rounded-xl border p-3 text-sm font-[450] leading-6"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={copyToClipboard}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
          disabled={!text}
        >
          Copy reply
        </button>
        <button
          onClick={openWhatsapp}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700"
          disabled={!text}
        >
          Open WhatsApp
        </button>
      </div>
    </div>
  );
}
