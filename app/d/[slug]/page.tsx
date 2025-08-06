// app/d/[slug]/page.tsx
import { Metadata } from 'next'

type Props = {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: `${params.slug}'s Page`,
    description: `Microsite for ${params.slug}`
  }
}

export default async function DentistPage({ params }: Props) {
  const { slug } = params

  // Replace this with actual Supabase fetch later
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Welcome, Dr. {slug}</h1>
      <p>This is your microsite.</p>
    </div>
  )
}

