// app/auth/callback/page.tsx
// @ts-nocheck
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// ensure per-request cookie read/write
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type Props = {
  searchParams?: {
    token_hash?: string;
    type?: string;          // "magiclink" | "signup" | "recovery" | ...
    next?: string;          // where to go after login
    code?: string;          // OAuth / PKCE fallback
  };
};

export default async function AuthCallback({ searchParams }: Props) {
  const supabase = createClient();

  const token_hash = (searchParams?.token_hash || "").toString();
  const type = (searchParams?.type || "magiclink").toString();
  const code = (searchParams?.code || "").toString();
  const next = decodeURIComponent(searchParams?.next || "/dashboard/leads");

  try {
    // 1) Magic-link / OTP flow
    if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({
        type: (type as any) || "magiclink",
        token_hash,
      });
      if (error) {
        // fall through to show a simple error page
        return (
          <div className="p-6">
            <h1 className="text-xl font-semibold">Sign-in error</h1>
            <p className="text-sm text-red-600 mt-2">{error.message}</p>
          </div>
        );
      }
      // success → redirect to next
      redirect(next);
    }

    // 2) OAuth / PKCE (if ever used)
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        return (
          <div className="p-6">
            <h1 className="text-xl font-semibold">Sign-in error</h1>
            <p className="text-sm text-red-600 mt-2">{error.message}</p>
          </div>
        );
      }
      redirect(next);
    }

    // 3) Nothing to verify → bounce home
    redirect("/login");
  } catch (e: any) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Sign-in error</h1>
        <p className="text-sm text-red-600 mt-2">
          {e?.message || "Unexpected error"}
        </p>
      </div>
    );
  }
}
