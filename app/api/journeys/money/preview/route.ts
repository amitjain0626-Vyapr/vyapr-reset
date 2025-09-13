// app/api/journeys/money/preview/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Compose a Money Alert preview (instant dopamine on payment).
// Inputs (POST): ?slug=...  body: { to:"+91...", amount:number, lead_name?:string, mode?:"upi"|"razorpay"|"cash" }
// Telemetry: {event:"journey.money.preview", ts, provider_id, lead_id:null, source:{via,to,provider_slug,amount,mode,lead_name}}
// No WA send here. Insert-only.
// Verify:
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/money/preview?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544","amount":750,"lead_name":"Test Lead","mode":"upi"}'
// Pass: {"ok":true,"event":"journey.money.preview"} present.
// === KOREKKO<>Provider: Journeys (1.0) ===

function json(status:number, body:any){ return NextResponse.json(body,{status}); }
function baseUrlFrom(req:NextRequest){ const b=process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/,""); if(b) return b; const h=req.headers.get("host")||""; return `https://${h}`; }
async function resolveProviderId(req:NextRequest, slug:string){
  const base = baseUrlFrom(req);
  const r = await fetch(`${base}/api/providers/resolve?slug=${encodeURIComponent(slug)}`,{cache:"no-store"});
  if(!r.ok) throw new Error(`provider_resolve_http_${r.status}`);
  const j = await r.json();
  if(!j?.ok || !j?.id) throw new Error("provider_resolve_invalid");
  return j.id as string;
}
function currency(v:any){ const n=Number(v); if(!isFinite(n)) return "₹0"; return "₹"+Math.round(n).toLocaleString("en-IN"); }

export async function POST(req:NextRequest){
  try{
    const {searchParams} = new URL(req.url);
    const slug = (searchParams.get("slug")||"").trim();
    if(!slug) return json(400,{ok:false,error:"missing_slug"});
    const body = (await req.json().catch(()=> ({})))||{};
    const to = String(body?.to||"").trim()||null;
    const amount = Number(body?.amount||0);
    const lead_name = body?.lead_name? String(body.lead_name).trim(): null;
    const mode = String(body?.mode||"upi").toLowerCase();

    const provider_id = await resolveProviderId(req, slug);

    const heading = "💸 Payment Received";
    const lines = [
      `${currency(amount)} ${mode === "cash" ? "(cash)" : ""}`.trim(),
      lead_name ? `From: ${lead_name}` : "From: —",
      "Great job! Keep the streak going → reply ‘Boost’?",
    ];
    const cta = "Reply ‘Boost’ to run a quick campaign.";

    const preview = { heading, lines, cta };

    // STRICT telemetry
    const base = baseUrlFrom(req);
    const payload = {
      event: "journey.money.preview",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: { via:"api.journeys.money.preview", to, provider_slug: slug, amount, mode, lead_name },
    };
    const t = await fetch(`${base}/api/events/log`,{
      method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store",
      body: JSON.stringify(payload),
    });
    if(!t.ok){ const detail = await t.text().catch(()=> ""); return json(500,{ok:false,error:"event_log_failed",detail}); }

    return json(200,{ ok:true, event:"journey.money.preview", provider_slug:slug, provider_id, to, preview });
  }catch(e:any){
    return json(500,{ok:false,error:"unexpected_error",detail:e?.message||String(e)});
  }
}
