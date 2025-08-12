// app/book/[slug]/page.tsx
// @ts-nocheck
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import BookingForm from "@/components/booking/BookingForm";

export const revalidate = 30;

type Dentist = {
  id: string;
  name: string | null;
  city: string | null;
  clinic_name: string | null;
  slug: string;
  is_published: boolean | null;
  profile_image_url: string | null;
};

function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    }
  );
}

export default async function Page(props: any) {
  const { params, searchParams } = props as {
    params: { slug: string };
    searchParams?: Record<string, string | string[] | undefined>;
  };

  const supabase = supabaseServer();
  const { data: dentist } = await supabase
    .from("Dentists")
    .select("id,name,city,clinic_name,slug,is_published,profile_image_url")
    .eq("slug", params.slug)
    .eq("is_published", true)
    .maybeSingle<Dentist>();

  if (!dentist) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-xl font-semibold">Booking unavailable</h1>
          <p className="text-sm text-gray-500 mt-2">
            This microsite isn’t published or the link is incorrect.
          </p>
        </div>
      </main>
    );
  }

  const utm: Record<string, string> = {};
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (typeof v === "string") utm[k] = v;
    else if (Array.isArray(v)) utm[k] = v.join(",");
  }

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-6">
      <section className="rounded-3xl border bg-white shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 border flex items-center justify-center">
            {dentist.profile_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dentist.profile_image_url}
                alt={dentist.name || "Dentist"}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl">🦷</span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Book with {dentist.name || "the dentist"}
            </h1>
            <div className="text-sm text-gray-600">
              {dentist.clinic_name ? `${dentist.clinic_name} • ` : ""}
              {dentist.city || ""}
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 border-t">
          <BookingForm slug={dentist.slug} utm={utm} />
        </div>

        <div className="border-t p-6 md:p-8 text-xs text-gray-500">
          Your details are shared only with this clinic for booking.
        </div>
      </section>
    </main>
  );
}
