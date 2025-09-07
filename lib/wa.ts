// @ts-nocheck
export function waDeeplink(phoneE164: string, text: string) {
  const q = new URLSearchParams({ text }).toString();
  const num = (phoneE164 || "").replace(/[^\d]/g, ""); // keep digits only
  return `https://wa.me/${num}?${q}`;
}
