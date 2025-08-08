// app/api/payments/razorpay-init/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { logServerRoute } from '@/lib/supabase/client-helpers'

export async function POST(req: Request) {
  logServerRoute('/api/payments/razorpay-init')

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { amount, currency = 'INR', leadId } = await req.json()

  // Placeholder: insert your Razorpay API logic here
  const order = {
    id: 'mock_order_id_' + Date.now(),
    amount,
    currency,
    status: 'created',
  }

  // Optional: log order to Supabase for tracking
  await supabase.from('Payments').insert({
    user_id: user.id,
    lead_id: leadId,
    razorpay_order_id: order.id,
    amount,
    currency,
    status: order.status,
  })

  return NextResponse.json({ success: true, order })
}
