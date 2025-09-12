// app/d/[slug]/opengraph-image.tsx
// @ts-nocheck
import { ImageResponse } from "next/og";

export const runtime = "edge";

/**
 * Minimal OG route:
 * - Always returns a 1200x630 PNG.
 * - Uses our static fallback asset `/og/default-provider.png`.
 * - No schema drift, no provider lookups. Safe and fast.
 */
export async function GET() {
  const BASE =
    process.env.NEXT_PUBLIC_BASE_URL || "https://korekko-reset.vercel.app";

  // Render the static default asset full-bleed
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // In case the asset fails to load, keep a neutral background.
          background: "#ffffff",
        }}
      >
        {/* Next/OG can fetch external images; give it an absolute URL */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${BASE}/og/default-provider.png`}
          alt="Korekko"
          width={1200}
          height={630}
          style={{ objectFit: "cover", width: "1200px", height: "630px" }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
