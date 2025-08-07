import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // ✅ handles promise

  const cookieHandler = {
    get: (name: string) => cookieStore.get(name)?.value,
    set: () => {},
    remove: () => {}
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieHandler }
  );
}
