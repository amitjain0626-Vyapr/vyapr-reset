'use client';

// @ts-nocheck
import { useActionState } from 'react';
import { createBooking } from '@/app/actions/book';

export default function BookingForm({ slug }: { slug: string }) {
  const [state, formAction] = useActionState(async (_prev: any, formData: FormData) => {
    // The server action will handle redirect on success or bounce back on error
    await createBooking(formData);
    return {}; // never reached on success (redirect), safe fallback
  }, {});

  return (
    <form action={formAction} className="mt-6 space-y-4" id="booking">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label className="block text-sm font-medium">Your name</label>
        <input
          name="patient_name"
          required
          className="mt-1 w-full rounded-xl border px-3 py-2"
          placeholder="e.g., Amit Jain"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Phone</label>
        <input
          name="phone"
          required
          inputMode="tel"
          className="mt-1 w-full rounded-xl border px-3 py-2"
          placeholder="10-digit mobile"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Note (optional)</label>
        <textarea
          name="note"
          rows={3}
          className="mt-1 w-full rounded-xl border px-3 py-2"
          placeholder="Brief reason for visit"
        />
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-black px-4 py-2 text-white"
      >
        Book Appointment
      </button>

      {/* Optional: light inline error hint if redirected back with ?error=... */}
      {/* You can render a message based on URLSearchParams in the parent page */}
    </form>
  );
}
