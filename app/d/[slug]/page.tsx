import { createClient } from '@/app/utils/supabase/server';
import { notFound } from 'next/navigation';

type PageProps = {
  params: {
    slug: string;
  };
};

export default async function MicrositePage({ params }: PageProps) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('dentists')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) return notFound();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{data.name}</h1>
      <p>{data.description}</p>
    </div>
  );
}
