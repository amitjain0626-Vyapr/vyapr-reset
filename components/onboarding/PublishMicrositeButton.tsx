'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function PublishMicrositeButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function publish() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/microsite/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: true }),
        });
        const data = await res.json();
        if (data?.ok) {
          toast.success('Microsite published!');
          router.push('/dashboard');
        } else {
          toast.error(data?.error ?? 'Failed to publish');
        }
      } catch (e) {
        toast.error('Failed to publish');
      }
    });
  }

  return (
    <button
      onClick={publish}
      disabled={pending}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 disabled:opacity-60"
    >
      {pending ? 'Publishing…' : 'Publish microsite'}
    </button>
  );
}
