// components/i18n/T.tsx
"use client";

import { useEffect, useState } from "react";
import type { JSX as JSXRuntime } from "react";

// Default language is always English for Vyapr↔Provider and Provider↔Customer
export type Lang = "en" | "hi";
const STORAGE_KEY = "vyapr.lang";
const COOKIE_KEY = "vyapr.lang"; // same key for cookie/local usage
const DEFAULT_LANG: Lang = "en";
const EVT = "vyapr:lang"; // cross-component update event

type TProps = {
  en: string;
  hi: string;
  as?: keyof JSXRuntime.IntrinsicElements;
  className?: string;
};

function readCookieLang(): Lang | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_KEY}=([^;]+)`));
    if (!m) return null;
    const v = decodeURIComponent(m[1]);
    return v === "en" || v === "hi" ? v : null;
  } catch {
    return null;
  }
}

export function getStoredLang(): Lang {
  try {
    // 1) localStorage first
    const v = (localStorage.getItem(STORAGE_KEY) as Lang) || "";
    if (v === "en" || v === "hi") return v;
    // 2) cookie fallback
    const ck = readCookieLang();
    if (ck) return ck;
    // 3) default English
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function setStoredLang(v: Lang) {
  try {
    // persist in localStorage
    localStorage.setItem(STORAGE_KEY, v);
    // persist in cookie (1 year)
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(v)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

    // reflect on <html>
    document.documentElement.setAttribute("data-lang", v);
    document.documentElement.setAttribute("lang", v);

    // broadcast to this tab
    window.dispatchEvent(new CustomEvent<Lang>(EVT, { detail: v }));
  } catch {
    // noop
  }
}

export default function T(props: TProps) {
  const { en, hi, as, className } = props;
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    // initialize from storage/cookie
    const v = getStoredLang();
    setLang(v);
    document.documentElement.setAttribute("data-lang", v);
    document.documentElement.setAttribute("lang", v);

    // listen for same-tab updates
    const onCustom = (e: Event) => {
      const v = (e as CustomEvent<Lang>).detail;
      if (v === "en" || v === "hi") {
        setLang(v);
        document.documentElement.setAttribute("data-lang", v);
        document.documentElement.setAttribute("lang", v);
      }
    };
    window.addEventListener(EVT, onCustom as EventListener);

    // cross-tab via storage
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const v = e.newValue as Lang;
        if (v === "en" || v === "hi") {
          setLang(v);
          document.documentElement.setAttribute("data-lang", v);
          document.documentElement.setAttribute("lang", v);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onCustom as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const Tag = (as || "span") as any;
  return <Tag className={className}>{lang === "en" ? en : hi}</Tag>;
}
