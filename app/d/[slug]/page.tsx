// ✅ Manually type params to avoid "implicit any" error
export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}) {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`,
  }
}

// ✅ Same here
export default async function DentistPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params

  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Welcome, Dr. {slug}</h1>
      <p>This is your microsite.</p>
    </div>
  )
}