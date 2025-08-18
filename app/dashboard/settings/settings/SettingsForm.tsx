'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';

export default function SettingsForm() {
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings/save', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data?.ok) {
          toast.success('Settings saved');
        } else {
          toast.error('Failed to save settings');
        }
      } catch {
        toast.error('Failed to save settings');
      }
    });
  }

  return (
    <form action={save} className="space-y-4 rounded-2xl border bg-white p-4">
      {/* your fields */}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
