// app/api/saved-views/[id]/route.ts
// Minimal App Router handler: ONLY export the HTTP method.
// No runtime/dynamic exports. Return plain Response.

import { createServerClient, type CookieOptions } from "@supabase/ssr";

/** tiny cookie reader from the request header */
function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  // cheap parse; handles "a=1; b=2"
  const parts = raw.split(";").map((s) => s.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i === -1) continue;
    const k = p.slice(0, i);
    if (k === name) return decodeURIComponent(p.slice(i + 1));
  }
  return undefined;
}

export async function DELETE(
  req: Request,
  ctx: { params: { id: string } }
): Promise<Response> {
  const id = (ctx?.params?.id ?? "").toString();
  if (!id || id.length < 10) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid id" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Supabase client with cookie passthrough from the incoming request
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return readCookie(req, name);
        },
        // For route handlers, we don't need to set/remove cookies here.
        set(_name: string, _value: string, _options: CookieOptions) {},
        remove(_name: string, _options: CookieOptions) {},
      },
    }
  );

  // Must be signed in (RLS will also enforce ownership)
  const { data: ures, error: uerr } = await supabase.auth.getUser();
  if (uerr || !ures?.user) {
    return new Response(JSON.stringify({ ok: false, error: "Not authenticated" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    }

  const { error } = await supabase.from("SavedViews").delete().eq("id", id);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
