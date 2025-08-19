// @ts-nocheck
import { NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/site';

export async function GET(req: Request) {
  const base = getBaseUrl(req.headers);
  const body = [
    'User-agent: *',
    'Allow: /',
    ``,
    `Sitemap: ${base}/sitemap.xml`,
    ``,
  ].join('\n');

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
