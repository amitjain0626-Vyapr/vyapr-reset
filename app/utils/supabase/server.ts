import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

// 🔁 Replace <any> with your Database types later, for now we skip types
export function createClient() {
  return createServerComponentClient<any>({ cookies })
}