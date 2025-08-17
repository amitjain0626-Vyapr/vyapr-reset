// app/api/payments/mark-paid/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { logServerRoute } from '@/lib/supabase/client-helpers'

export async function POST(req: Request) {
  logServerRoute('/api/payments/mark-paid')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { leadId } = await req.json()

  const { error } = await supabase
    .from('Leads')
    .update({ payment_status: 'paid' })
    .eq('id', leadId)
    .eq('created_by', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
