import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  const redirectTo = 'https://vyapr-reset-5rly-lfaa3pvlc-amit-jains-projects-88081448.vercel.app/auth/callback';

  const res = await fetch(
    `https://xqyvmvktfspovsvwkaet.supabase.co/auth/v1/magiclink`,
    {
      method: 'POST',
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        redirect_to: redirectTo,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ success: false, error: data.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
