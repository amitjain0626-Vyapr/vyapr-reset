import './globals.css';
import { ReactNode } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export const metadata = {
  title: 'Vyapr',
  description: 'Vyapr - Digital Stack for Solopreneurs',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = createClient();

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
