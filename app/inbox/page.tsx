// @ts-nocheck
import LeadInbox from "@/components/inbox/LeadInbox";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Works with Next 15 where searchParams may be a Promise.
export default async function InboxPage(props: any) {
  const sp = (props?.searchParams && typeof props.searchParams.then === "function")
    ? await props.searchParams
    : (props?.searchParams || {});
  const slug = (sp?.slug || "").toString().trim();

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  );

  let ownerOk = true;
  if (slug) {
    const { data: p } = await supabase.from("providers").select("id").eq("slug", slug).maybeSingle();
    ownerOk = !!p;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-xl md:text-2xl font-semibold mb-3">Lead Inbox</h1>
      {!slug && <div className="text-sm text-red-600 mb-3">Missing slug. Append <code>?slug=&lt;your-slug&gt;</code> to the URL.</div>}
      {!ownerOk && <div className="text-sm text-red-600 mb-3">You don’t have access to this inbox.</div>}
      {slug && ownerOk && <LeadInbox slug={slug} />}
    </main>
  );
}
