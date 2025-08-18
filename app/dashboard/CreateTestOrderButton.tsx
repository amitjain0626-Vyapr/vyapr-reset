'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

export default function CreateTestOrderButton() {
  const [pending, startTransition] = useTransition();

  async function createOrder() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/orders/create-test', { method: 'POST' });
        const data = await res.json();
        if (data?.id) {
          toast.success(`Test order created (#${data.id})`);
        } else {
          toast.error('Failed to create test order');
        }
      } catch {
        toast.error('Failed to create test order');
      }
    });
  }

  return (
    <button
      onClick={createOrder}
      disabled={pending}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
    >
      {pending ? 'Creating…' : 'Create Test Order'}
    </button>
  );
}
