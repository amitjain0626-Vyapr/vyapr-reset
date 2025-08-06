import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';

// Define params type separately
type Params = {
  slug: string;
};

// Use direct type annotation instead of interface
export default async function Page({ params }: { params: Params }) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) {
    notFound();
  }

  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
    </div>
  );
}

// Add this empty declaration to prevent Promise type conflict
declare module 'next' {
  interface PageProps {
    params: any;
  }
}