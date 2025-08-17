import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function POST(req: Request) {
  const supabase = await createClient();

  // ⬇️ placeholder logic to keep route valid
  console.log('Update route hit');
  return redirect('/dashboard');
}
