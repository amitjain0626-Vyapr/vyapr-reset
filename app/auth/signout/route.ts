// app/auth/signout/route.ts

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET() {
  const cookieStore = await cookies();

  cookieStore.delete('sb-access-token');
  cookieStore.delete('sb-refresh-token');

  redirect('/login');
}
