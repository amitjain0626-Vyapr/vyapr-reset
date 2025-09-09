// components/i18n/T.tsx
"use client";

import { useEffect, useState } from "react";
import type { JSX as JSXRuntime } from "react";
import { KEYS, LEGACY_KEYS } from "@/lib/brand";

export type Lang = "en" | "hi";
const EVT = "korekko:lang"; // brand-scoped bus

type TProps = {
  en: string;
  hi: string;
  as?: keyof JSXRuntime.IntrinsicElements;
  className?: string;
};

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function readCookieLang(): Lang | null {
  const v = readCookie(KEYS.langCookie) || readCookie(LEGACY_KEYS.langCookie);
  return v === "en" || v === "hi" ? v : null;
}

export function getStoredLang(): Lang {
  try {
    // new → legacy → default
    const vNow = (localStorage.getItem(KEYS.langLocal) as Lang) || "";
    if (vNow === "en" || vNow === "hi") return vNow;

    const vOld = (localStorage.getItem(LEGACY_KEYS.langLocal) as Lang) || "";
    if (vOld === "en" || vOld === "hi") return vOld;

    const ck = readCookieLang();
    if (ck) return ck;

    return "en";
  } catch {
    return "en";
  }
}

export function setStoredLang(v: Lang) {
  try {
    // write new keys
    localStorage.setItem(KEYS.langLocal, v);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${KEYS.langCookie}=${encodeURIComponent(v)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;

    // reflect on <html>
    document.documentElement.setAttribute("data-lang", v);
    document.documentElement.setAttribute("lang", v);

    // broadcast (brand-scoped)
    window.dispatchEvent(new CustomEvent<Lang>(EVT, { detail: v }));
  } catch {}
}

export default function T(props: TProps) {
  const { en, hi, as, className } = props;
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const v = getStoredLang();
    setLang(v);
    document.documentElement.setAttribute("data-lang", v);
    document.documentElement.setAttribute("lang", v);

    const onCustom = (e: Event) => {
      const v = (e as CustomEvent<Lang>).detail;
      if (v === "en" || v === "hi") {
        setLang(v);
        document.documentElement.setAttribute("data-lang", v);
        document.documentElement.setAttribute("lang", v);
      }
    };
    window.addEventListener(EVT, onCustom as EventListener);

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.langLocal && e.newValue) {
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
