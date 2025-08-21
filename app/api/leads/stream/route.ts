// app/api/leads/stream/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

async function latestHeadForUser(userId: string, supabase: any) {
  const { data: providers } = await supabase
    .from("Providers")
    .select("id")
    .eq("owner_id", userId);

  const ids = (providers || []).map((p: any) => p.id);
  if (!ids.length) return "";

  const { data } = await supabase
    .from("Leads")
    .select("id, created_at")
    .in("provider_id", ids)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || !data.length) return "";
  const row = data[0];
  return `${row.id}|${row.created_at}`;
}

export async function GET() {
  const cookieStore = cookies();
  const hdrs = headers();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { get: (n: string) => cookieStore.get(n)?.value },
      headers: { get: (n: string) => hdrs.get(n) ?? undefined },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: any) {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Initial head snapshot
      let head = await latestHeadForUser(user.id, supabase);
      send("hello", { ok: true, head });

      // Heartbeat every 15s to keep connections alive
      const heartbeat = setInterval(() => {
        send("hb", { t: Date.now() });
      }, 15_000);

      // Poll DB every 5s for changes in head
      const poll = setInterval(async () => {
        try {
          const nextHead = await latestHeadForUser(user.id, supabase);
          if (nextHead && nextHead !== head) {
            head = nextHead;
            send("leads.updated", { head });
          }
        } catch {
          // swallow and continue
        }
      }, 5_000);

      // Close handler
      // @ts-ignore
      controller.oncancel = () => {
        clearInterval(heartbeat);
        clearInterval(poll);
      };
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx/proxies
    },
  });
}
