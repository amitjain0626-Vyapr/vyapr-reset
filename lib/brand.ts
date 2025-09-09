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
