// app/d/[slug]/page.tsx

export async function generateMetadata({ params }: any) {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`,
  }
}

export default async function DentistPage({ params }: any) {
  const { slug } = params

  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Welcome, Dr. {slug}</h1>
      <p>This is your microsite.</p>
    </div>
  )
}
