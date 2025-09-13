// app/api/journeys/money/send/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// === KOREKKO<>Provider: Journeys (1.0) ===
// Purpose: Send Money Alert on WA using existing /api/wa/send.
// Flow: POST → compose preview → build text → /api/wa/send GET (phone,text) → log telemetry.
// Inputs (POST): ?slug=...  body: { to:"+91...", amount:number, lead_name?:string, mode?:"upi"|"razorpay"|"cash" }
// Event: "journey.money.sent"
// Verify:
//   BASE="https://www.vyapr.com"; \
//   curl -sS -X POST "$BASE/api/journeys/money/send?slug=amitjain0626" \
//     -H "Content-Type: application/json" \
//     -d '{"to":"+919873284544","amount":750,"lead_name":"Test Lead","mode":"upi"}'
// Pass: {"ok":true,"event":"journey.money.sent"} present.
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
function buildText(preview:any){
  const h = preview?.heading ? String(preview.heading) : "Payment Received";
  const lines:string[] = Array.isArray(preview?.lines) ? preview.lines.map((x:any)=> String(x)) : [];
  const cta = preview?.cta ? String(preview.cta) : "";
  const bullet = lines.length ? "\n- "+lines.join("\n- ") : "";
  const tail = cta ? `\n\n${cta}` : "";
  return `${h}${bullet}${tail}`;
}
function normalizePhoneForQuery(to:string){ const digits = String(to).replace(/\D/g,""); return digits || String(to).replace(/^\+/, ""); }

async function waSendGET(base:string, to:string, text:string){
  const phone = normalizePhoneForQuery(to);
  const url = `${base}/api/wa/send?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(text)}`;
  const r = await fetch(url, { method:"GET", cache:"no-store", redirect:"manual" as any });
  const okRedirect = new Set([200,301,302,303,307,308]);
  return { ok: okRedirect.has(r.status), status: r.status, body: await r.text().catch(()=> "") };
}

export async function POST(req:NextRequest){
  try{
    const {searchParams} = new URL(req.url);
    const slug = (searchParams.get("slug")||"").trim();
    if(!slug) return json(400,{ok:false,error:"missing_slug"});

    const body = (await req.json().catch(()=> ({})))||{};
    const to = String(body?.to||"").trim();
    const amount = Number(body?.amount||0);
    const lead_name = body?.lead_name? String(body.lead_name).trim() : null;
    const mode = String(body?.mode||"upi").toLowerCase();
    if(!to || !isFinite(amount)) return json(400,{ok:false,error:"missing_to_or_amount"});

    const base = baseUrlFrom(req);
    const provider_id = await resolveProviderId(req, slug);

    // compose
    const comp = await fetch(`${base}/api/journeys/money/preview?slug=${encodeURIComponent(slug)}`,{
      method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store",
      body: JSON.stringify({ to, amount, lead_name, mode }),
    });
    if(!comp.ok){ const detail = await comp.text().catch(()=> ""); return json(502,{ok:false,error:"compose_failed",detail}); }
    const composed = await comp.json();
    const text = buildText(composed?.preview||{});

    // send
    const wa = await waSendGET(base, to, text);
    if(!wa.ok) return json(502,{ok:false,error:"wa_send_failed",status:wa.status,detail:wa.body});

    // telemetry
    const telemetry = {
      event: "journey.money.sent",
      ts: Date.now(),
      provider_id,
      lead_id: null,
      source: { via:"api.journeys.money.send", to, provider_slug: slug, amount, mode, lead_name, transport:"GET" },
    };
    const t = await fetch(`${base}/api/events/log`,{
      method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store",
      body: JSON.stringify(telemetry),
    });
    if(!t.ok){ const detail = await t.text().catch(()=> ""); return json(500,{ok:false,error:"event_log_failed",detail}); }

    return json(200,{ ok:true, event:"journey.money.sent", provider_slug:slug, provider_id, to, wa });
  }catch(e:any){
    return json(500,{ok:false,error:"unexpected_error",detail:e?.message||String(e)});
  }
}
