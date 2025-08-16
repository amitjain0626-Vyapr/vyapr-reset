// utils/supabase/client.ts
// @ts-nocheck
import { createBrowserClient } from "@supabase/ssr";

// ✅ named export exactly: supabase
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
