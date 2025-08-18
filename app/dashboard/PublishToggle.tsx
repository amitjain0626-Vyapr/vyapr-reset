'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';

export default function PublishToggle({ initial }: { initial: boolean }) {
  const [published, setPublished] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/microsite/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ published: !published }),
        });
        const data = await res.json();
        if (data?.ok) {
          setPublished(!published);
          toast.success(!published ? 'Microsite published' : 'Microsite unpublished');
        } else {
          toast.error('Failed to update publish status');
        }
      } catch {
        toast.error('Failed to update publish status');
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {pending ? 'Updating…' : published ? 'Unpublish' : 'Publish'}
    </button>
  );
}
