// @ts-nocheck
import type { Metadata } from 'next';
import './globals.css';
import ToastProvider from '@/components/ui/ToastProvider';

export const metadata: Metadata = {
  title: 'Vyapr',
  description: 'Vyapr for India’s Solos',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-gray-50 text-gray-900">
        <ToastProvider />
        {children}
      </body>
    </html>
  );
}
