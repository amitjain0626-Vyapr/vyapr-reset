// app/login/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sent = url.searchParams.get("sent") === "1";
  const error = url.searchParams.get("error") || "";
  const next = url.searchParams.get("next") || "/onboarding";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Sign in • Korekko</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin:0; padding:40px 16px; background:#f9fafb; color:#0f172a;}
      .card { max-width:420px; margin:0 auto; background:#fff; border:1px solid #e5e7eb; border-radius:16px; padding:24px;}
      h1 { font-size:20px; margin:0 0 8px;}
      p { margin:0 0 8px; color:#475569; font-size:14px;}
      .row { margin-top:16px;}
      input, button { font: inherit; }
      input[type="email"]{ width:100%; padding:10px 12px; border:1px solid #e5e7eb; border-radius:12px;}
      button{ width:100%; margin-top:12px; background:#0f766e; color:#fff; border:none; padding:10px 12px; border-radius:12px; cursor:pointer;}
      button:hover{ background:#115e59;}
      .note{ font-size:12px; color:#64748b; margin-top:12px;}
      .ok{ background:#ecfeff; color:#0e7490; border:1px solid #a5f3fc; padding:8px 10px; border-radius:12px; margin:12px 0;}
      .err{ background:#fef2f2; color:#b91c1c; border:1px solid #fecaca; padding:8px 10px; border-radius:12px; margin:12px 0;}
      code{ background:#f1f5f9; padding:2px 6px; border-radius:6px;}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sign in</h1>
      <p>We’ll email you a one‑tap magic link.</p>

      ${sent ? `<div class="ok">Check your email for the magic link.</div>` : ``}
      ${error ? `<div class="err">${error === "email" ? "Please enter a valid email." : error}</div>` : ``}

      <!-- IMPORTANT: post to the route that exists in your build -->
      <form method="POST" action="/api/auth/magiclink">
        <input type="hidden" name="next" value="${encodeURIComponent(next)}" />
        <div class="row">
          <input type="email" name="email" placeholder="you@example.com" required />
        </div>
        <div class="row">
          <button type="submit">Send magic link</button>
        </div>
      </form>

      <div class="note">After sign‑in you’ll be redirected to: <code>${next}</code></div>
    </div>
  </body>
</html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
