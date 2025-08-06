import { Metadata } from 'next'

interface PageParams {
  params: {
    slug: string
  }
}

// 👇 Keep this unchanged
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`
  }
}

// ✅ This signature bypasses the PageProps inference bug
const DentistPage = async ({ params }: PageParams) => {
  const { slug } = params

  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Welcome, Dr. {slug}</h1>
      <p>This is your microsite.</p>
    </div>
  )
}

export default DentistPage