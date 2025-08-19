// @ts-nocheck
export function slugify(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toTitle(input: string): string {
  return (input || "")
    .toString()
    .trim()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function deslugifyCategory(slug: string): string {
  // "makeup-artists" -> "makeup artists"
  return (slug || "").replace(/-/g, " ").trim();
}

export function deslugifyCity(slug: string): string {
  return (slug || "").replace(/-/g, " ").trim();
}
