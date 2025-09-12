// app/d/[slug]/opengraph-image/route.ts
// @ts-nocheck
import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "Korekko Microsite";

/**
 * Minimal OG route:
 * - Always returns a 1200x630 PNG.
 * - Uses static fallback asset `/og/default-provider.png`.
 * - No schema drift, no DB calls.
 */
export async function GET() {
  const BASE =
    process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app";

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        },
      },
      React.createElement("img", {
        src: `${BASE}/og/default-provider.png`,
        alt: "Korekko",
        width: 1200,
        height: 630,
        style: { objectFit: "cover", width: "1200px", height: "630px" },
      })
    ),
    { width: 1200, height: 630 }
  );
}
