import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';

// No params typed here — avoid Promise<any> inference
export default async function SlugPage({ params }: any) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('Dentists')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{data.name}</h1>
      <p>{data.description}</p>
    </div>
  );
}
