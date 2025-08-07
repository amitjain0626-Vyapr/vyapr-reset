import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies(); // ✅ await is required for your version

  const cookieHandler = {
    get: (name: string) => cookieStore.get(name)?.value,
    set: (name: string, value: string, options: CookieOptions) => {
      try {
        cookieStore.set({ name, value, ...options });
      } catch (error) {
        // ignore errors in server components
      }
    },
    remove: (name: string, options: CookieOptions) => {
      try {
        cookieStore.delete({ name, ...options });
      } catch (error) {
        // ignore errors in server components
      }
    },
  };

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: cookieHandler,
    }
  );
}
