'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

export default function CreateTestPaymentButton() {
  const [pending, startTransition] = useTransition();

  function createPayment() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/payments/create-test', { method: 'POST' });
        const data = await res.json();
        if (data?.ok) {
          toast.success('Test payment created');
          // reload so the new row appears
          window.location.reload();
        } else {
          toast.error(data?.error ?? 'Failed to create test payment');
        }
      } catch {
        toast.error('Failed to create test payment');
      }
    });
  }

  return (
    <button
      onClick={createPayment}
      disabled={pending}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create Test Payment'}
    </button>
  );
}
