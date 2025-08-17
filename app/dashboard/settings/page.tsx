// app/dashboard/settings/page.tsx
import { createClient } from '@/utils/supabase/server'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: dentist } = await supabase
    .from('Dentists')
    .select('*')
    .eq('user_id', user?.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <div className="text-sm text-gray-500 mb-2">
        Microsite:
      </div>
      <div className="text-blue-600 font-medium">{dentist?.slug}</div>

      <a
        className="inline-block mt-3 underline"
        href={`/d/${dentist.slug}`}
        target="_blank"
        rel="noreferrer"
      >
        Preview Microsite
      </a>
    </div>
  )
}
