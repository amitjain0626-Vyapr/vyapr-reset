// @ts-nocheck
export const dynamic = "force-dynamic";

export default async function Page({ params }: any) {
  const slug = params?.slug ?? "(no-slug)";
  return (
    <div className="mx-auto max-w-md p-6 space-y-4">
      <div className="text-[10px] uppercase tracking-widest text-gray-500">VYAPR-9.5 PING</div>
      <h1 className="text-xl font-semibold">/book/{slug}</h1>
      <p className="text-sm text-gray-600">
        If you can read this, this route is using THIS file.
      </p>
    </div>
  );
}
