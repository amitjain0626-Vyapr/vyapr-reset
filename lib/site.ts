// @ts-nocheck
/**
 * Returns the base URL for building absolute links
 * Works both on Vercel and local dev
 */
export function getBaseUrl(headers?: Headers) {
  const forwardedHost = headers?.get?.('x-forwarded-host');
  const host =
    forwardedHost ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'localhost:3000';

  const proto =
    headers?.get?.('x-forwarded-proto') ||
    (host.includes('localhost') ? 'http' : 'https');

  return `${proto}://${host}`;
}
