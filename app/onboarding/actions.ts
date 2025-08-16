// @ts-nocheck
"use server";

import { cookies, headers } from "next/headers";

export async function publishProviderAction(formData: FormData | Record<string, any>) {
  // Accept both FormData and plain objects
  const body =
    typeof (formData as any).get === "function"
      ? {
          name: (formData as any).get("name")?.toString() || "",
          phone: (formData as any).get("phone")?.toString() || "",
          city: (formData as any).get("city")?.toString() || "",
          category: (formData as any).get("category")?.toString() || "",
          slug: (formData as any).get("slug")?.toString() || "",
          publish: ((formData as any).get("publish") ?? "true").toString() !== "false",
        }
      : {
          name: (formData as any)?.name?.toString?.() || "",
          phone: (formData as any)?.phone?.toString?.() || "",
          city: (formData as any)?.city?.toString?.() || "",
          category: (formData as any)?.category?.toString?.() || "",
          slug: (formData as any)?.slug?.toString?.() || "",
          publish: Boolean((formData as any)?.publish ?? true),
        };

  // Server action posts to our hardened API
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/dentists/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Forward a couple of headers to preserve auth context if needed
        "x-forwarded-for": headers().get("x-forwarded-for") || "",
        "x-request-id": headers().get("x-request-id") || "",
      },
      body: JSON.stringify(body),
      // cookies() are sent by default on same-origin in Next server actions
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.ok) {
      const err = json?.error || { code: "unknown", message: "Unexpected error" };
      return { ok: false, error: err };
    }

    return { ok: true, slug: json.slug, redirectTo: json.redirectTo || `/dashboard?slug=${json.slug}` };
  } catch (e: any) {
    return {
      ok: false,
      error: { code: "network_error", message: "Network error during publish.", details: e?.message || String(e) },
    };
  }
}
