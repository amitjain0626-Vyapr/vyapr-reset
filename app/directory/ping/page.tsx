export default function Page() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Directory route: OK</h1>
      <p className="text-sm text-gray-600">If you can see this, /directory is wired.</p>
    
      <DirectorySitemapSeo baseUrl={process.env.NEXT_PUBLIC_BASE_URL || "https://vyapr-reset-5rly.vercel.app"} />
</main>
  );
}
