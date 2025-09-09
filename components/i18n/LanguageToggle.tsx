// components/i18n/LanguageToggle.tsx
"use client";

import { useEffect, useState } from "react";
import { getStoredLang, setStoredLang } from "./T";
import type { Lang } from "./T";

export default function LanguageToggle() {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    setLang(getStoredLang());
  }, []);

  const apply = (v: Lang) => {
    setStoredLang(v);
    setLang(v);
    // best-effort persist server-side (ok if 401)
    fetch("/api/provider/lang", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang_pref: v }),
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
      role="group"
      aria-label="Language selector"
    >
      <button
        type="button"
        onClick={() => apply("en")}
        className={`px-2 py-0.5 rounded-full ${
          lang === "en" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
        }`}
        aria-pressed={lang === "en"}
        aria-label="Switch to English"
      >
        English
      </button>
      <button
        type="button"
        onClick={() => apply("hi")}
        className={`px-2 py-0.5 rounded-full ${
          lang === "hi" ? "bg-gray-900 text-white" : "hover:bg-gray-100"
        }`}
        aria-pressed={lang === "hi"}
        aria-label="Switch to Hinglish"
      >
        Hinglish
      </button>
    </div>
  );
}
