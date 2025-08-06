// app/d/[slug]/page.tsx
import { createClient } from '@/app/utils/supabase/server';

export default async function Page({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) {
    return <div>Not found</div>;
    // or redirect:
    // return redirect('/not-found');
  }

  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
    </div>
  );
}