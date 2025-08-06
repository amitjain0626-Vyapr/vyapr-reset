// app/d/[slug]/page.tsx
import { createClient } from "@/app/utils/supabase/server";
import { notFound } from "next/navigation";

interface PageParams {
  params: {
    slug: string;
  };
}

export default async function Page({ params }: PageParams) {
  const supabase = createClient();

  const { data: dentist, error } = await supabase
    .from("dentists")
    .select("*")
    .eq("slug", params.slug)
    .single();

  if (error || !dentist) {
    console.error("❌ Slug fetch error:", error);
    notFound();
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Welcome, Dr. {dentist.name}</h1>
      <p className="text-gray-600 mt-2">This is your microsite.</p>
    </div>
  );
}