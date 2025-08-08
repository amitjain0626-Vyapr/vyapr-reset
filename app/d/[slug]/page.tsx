// @ts-nocheck
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function Page({ params }: any) {
  const slug = params?.slug?.toString() ?? '';
  if (!slug) notFound();

  const cookieStore = cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supabase
    .from('Dentists')
    .select('*')
    .ilike('slug', slug)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>{data.name ?? slug}</h1>
      {data.city && <p>{data.city}</p>}
    </main>
  );
}
