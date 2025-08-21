// app/api/debug/sse-check/route.ts
// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (event: string, data: any) => {
        controller.enqueue(enc.encode(`event: ${event}\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // First hello
      send("hello", { ok: true, t: Date.now() });

      // Keepalive every 2s (prevents proxies from buffering/closing)
      const tick = setInterval(() => {
        send("tick", { t: Date.now() });
      }, 2000);

      // @ts-ignore: allow GC-safe shutdown
      controller.oncancel = () => clearInterval(tick);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
