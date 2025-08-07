import './globals.css';
import { createSupabaseServerClient } from './utils/supabase/server';

export const metadata = {
  title: 'Vyapr',
  description: 'Digital stack for solopreneurs',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
