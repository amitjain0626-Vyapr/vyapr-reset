// components/ui/KpiCard.tsx
// @ts-nocheck
"use client";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  deltaText?: string;
  help?: string;           // shown as title tooltip on hover
  tone?: "success" | "warn" | "info" | "neutral";
};

export default function KpiCard({ label, value, hint, deltaText, help, tone = "neutral" }: Props) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 border-amber-200"
      : tone === "info"
      ? "bg-indigo-50 border-indigo-200"
      : "bg-white";

  return (
    <div
      className={`rounded-xl border p-3 ${toneClass}`}
      title={help || ""}
      role="note"
      aria-label={`${label} ${value}${deltaText ? `, ${deltaText}` : ""}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-6">{typeof value === "number" ? value : value}</div>
      {hint ? <div className="text-[11px] text-gray-500 mt-0.5">{hint}</div> : null}
      {deltaText ? (
        <div
          className={`text-[12px] mt-1 ${
            deltaText.startsWith("↑")
              ? "text-emerald-700"
              : deltaText.startsWith("↓")
              ? "text-rose-700"
              : "text-gray-600"
          }`}
        >
          {deltaText}
        </div>
      ) : null}
    </div>
  );
}
