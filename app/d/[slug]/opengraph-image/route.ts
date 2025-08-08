// @ts-nocheck
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/app/utils/supabase/server";

export const runtime = "edge";
export const alt = "Vyapr Microsite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = await createSupabaseServerClient();
  const slug = (params?.slug || "").toLowerCase();

  const { data: d } = await supabase
    .from("Dentists")
    .select("name, city, state, profile_image_url, clinic_image_url, is_published")
    .ilike("slug", slug)
    .maybeSingle();

  const name = d?.name || "Your Dentist";
  const loc = [d?.city, d?.state].filter(Boolean).join(", ");
  const bg = d?.clinic_image_url || d?.profile_image_url;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: "#0f172a",
          color: "white",
          padding: "48px",
          position: "relative",
        }}
      >
        {bg ? (
          <img
            src={bg}
            alt=""
            width={1200}
            height={630}
            style={{
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              opacity: 0.3,
              filter: "grayscale(30%) blur(0px)",
            }}
          />
        ) : null}

        <div
          style={{
            fontSize: 60,
            fontWeight: 700,
            lineHeight: 1.1,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 28,
            opacity: 0.9,
            textShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {loc || "Book your visit online"}
        </div>

        <div
          style={{
            position: "absolute",
            top: 32,
            right: 32,
            fontSize: 22,
            background: "rgba(15,23,42,0.8)",
            padding: "8px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          vyapr.com
        </div>
      </div>
    ),
    { ...size }
  );
}
