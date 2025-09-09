// lib/brand.ts
// Single source of truth for brand + URLs + storage keys.
// Safe to change when rebranding.

export const BRAND = {
  name: "Korekko",
  slug: "korekko",

  // Base URL used across SEO/links (falls back to staging default)
  baseUrl:
    (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "") ||
    "https://korekko-reset.vercel.app",

  // Storage/cookie prefixes (new) — keep legacy read for Vyapr
  storagePrefix: "korekko",
  legacyStoragePrefix: "vyapr",
};

// ---- Helpers ----
export function absUrl(path = "/") {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BRAND.baseUrl}${p}`;
}

// New keys
export const KEYS = {
  langCookie: `${BRAND.storagePrefix}.lang`,
  langLocal: `${BRAND.storagePrefix}.lang`,
  lastSlug: `${BRAND.storagePrefix}:lastSlug`,
};

// Legacy (read-only) keys to migrate from silently
export const LEGACY_KEYS = {
  langCookie: `${BRAND.legacyStoragePrefix}.lang`,
  langLocal: `${BRAND.legacyStoragePrefix}.lang`,
  lastSlug: `${BRAND.legacyStoragePrefix}:lastSlug`,
};
// === KOREKKO: Brand migration helpers START (safe, insert-only) ===
// @ts-nocheck

// Human-facing phrases centralised here to avoid hard-coding "Vyapr" anywhere.
export const COPY = {
  verifiedBy: `✓ Verified by ${BRAND.name}`,
  viaShort: `via ${BRAND.name}`,
  dashboardTitle: `${BRAND.name} — Dashboard`,
  bookingTitle: `${BRAND.name} booking`,
  micrositeName: `${BRAND.name} Microsite`,
  // Fallbacks for WA/SMS text fragments
  waPrefix: (provider?: string) =>
    provider ? `— ${provider} (${BRAND.name})` : `— ${BRAND.name}`,
  waVia: (slug?: string) =>
    slug ? `via ${BRAND.name} ${absUrl(`/book/${slug}`)}` : `via ${BRAND.name}`,
};

// Minimal “brandify” helper for rare dynamic strings still containing old brand.
export function brandify(s: string) {
  if (!s) return s;
  return s.replace(/\bVyapr\b/g, BRAND.name);
}

// ------- Storage/Cookie migration (dual-read, write-new) -------
const isBrowser = typeof window !== "undefined";
const hasDoc = typeof document !== "undefined";

function getCookie(name: string): string | null {
  if (!hasDoc) return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (!hasDoc) return;
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}; expires=${d.toUTCString()}; path=/; samesite=Lax`;
}

export const storage = {
  getLocal(newKey: string, legacyKey?: string) {
    if (!isBrowser) return null;
    try {
      const v = window.localStorage.getItem(newKey);
      if (v !== null) return v;
      if (legacyKey) {
        const old = window.localStorage.getItem(legacyKey);
        if (old !== null) {
          // migrate-on-read
          window.localStorage.setItem(newKey, old);
          return old;
        }
      }
      return null;
    } catch {
      return null;
    }
  },
  setLocal(newKey: string, value: string) {
    if (!isBrowser) return;
    try {
      window.localStorage.setItem(newKey, value);
    } catch {}
  },
  getCookie(newKey: string, legacyKey?: string) {
    const v = getCookie(newKey);
    if (v !== null) return v;
    if (legacyKey) {
      const old = getCookie(legacyKey);
      if (old !== null) {
        // migrate-on-read
        setCookie(newKey, old);
        return old;
      }
    }
    return null;
  },
  setCookie(newKey: string, value: string, days?: number) {
    setCookie(newKey, value, days);
  },
};

// One-shot silent migration for the common keys (runs on client only)
export function migrateBrandStorageOnce() {
  if (!isBrowser) return;
  // lang
  const lang =
    storage.getCookie(KEYS.langCookie, LEGACY_KEYS.langCookie) ||
    storage.getLocal(KEYS.langLocal, LEGACY_KEYS.langLocal);
  if (lang) {
    storage.setCookie(KEYS.langCookie, lang);
    storage.setLocal(KEYS.langLocal, lang);
  }
  // lastSlug
  const slug = storage.getLocal(KEYS.lastSlug, LEGACY_KEYS.lastSlug);
  if (slug) {
    storage.setLocal(KEYS.lastSlug, slug);
  }
}

// Convenience: build tracked WA prefill text that already includes brand
export function waViaText(slug?: string, extra?: string) {
  const via = COPY.waVia(slug);
  return extra ? `${extra} (${via})` : via;
}

// === KOREKKO: Brand migration helpers END ===
