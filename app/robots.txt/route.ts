// app/robots.txt/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

export async function GET() {
  const BASE = BRAND.baseUrl;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Allow: /d/",
    "Allow: /directory",
    "Allow: /book/",
    "Allow: /card/",
    "Disallow: /dashboard",
    "Disallow: /onboarding",
    "Disallow: /auth",
    "",
    `Host: ${BASE.replace(/^https?:\/\//, "")}`,
    `Sitemap: ${BASE}/sitemap.xml`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
