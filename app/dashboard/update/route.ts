import { createClient } from '@/app/utils/supabase/server';
import { redirect } from 'next/navigation';

export async function POST(req: Request) {
  const supabase = await createClient();
  const formData = await req.formData();

  const id = formData.get('id') as string;

  const updates = {
    id,
    name: formData.get('name'),
    slug: formData.get('slug'),
    whatsapp: formData.get('whatsapp'),
    razorpay: formData.get('razorpay'),
    description: formData.get('description'),
    updated_at: new Date().toISOString(),
  };

  // Upsert profile
  await supabase.from('Dentists').upsert(updates, { onConflict: 'id' });

  return redirect('/dashboard');
}
