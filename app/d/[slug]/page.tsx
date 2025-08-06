import { createClient } from "@/app/utils/supabase/server";

// Explicitly define your params type
type PageParams = {
  slug: string;
};

// Use Next.js's built-in types for the page component
export default async function Page({
  params,
}: {
  params: PageParams;
}) {
  const supabase = createClient();
  
  // Fetch your data
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (error || !data) {
    return <div>Not found</div>;
    // Or for proper 404 handling:
    // notFound();
  }

  return (
    <div>
      <h1>{data.title}</h1>
      <p>{data.content}</p>
    </div>
  );
}

// If you need to generate static paths (optional)
export async function generateStaticParams() {
  return []; // Return empty array for pure SSR
}

// Type declaration merging for Next.js
declare module 'next' {
  interface PageProps {
    params: PageParams;
  }
}