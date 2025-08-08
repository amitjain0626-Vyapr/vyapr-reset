// @ts-nocheck
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const cookies = Object.fromEntries(
    (req.headers.get('cookie') ?? '')
      .split(';')
      .map(v => v.trim())
      .filter(Boolean)
      .map(kv => {
        const [k, ...rest] = kv.split('=');
        return [k, decodeURIComponent(rest.join('='))];
      })
  );

  return NextResponse.json(
    {
      hasAccess: Boolean(cookies['sb-access-token']),
      hasRefresh: Boolean(cookies['sb-refresh-token']),
      // debug keys only indicate presence, not values
    },
    { status: 200 }
  );
}
