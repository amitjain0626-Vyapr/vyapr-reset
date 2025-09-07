// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function baseUrl() {
  const env = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return env && /^https?:\/\//i.test(env) ? env : "https://vyapr-reset-5rly.vercel.app";
}

export async function GET() {
  const BASE = baseUrl();
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
