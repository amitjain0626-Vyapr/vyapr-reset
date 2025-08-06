import { createClient } from '@/app/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect('/login');

  const { data: profile } = await supabase
    .from('Dentists')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        Welcome, {profile?.name || 'Dentist'} 🦷
      </h1>

      {!profile?.whatsapp && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6 rounded">
          <p className="font-semibold">Heads up! 👋</p>
          <p className="text-sm">
            Add your WhatsApp number so clients can instantly reach you.
            You’ll also unlock future CRM tools like auto-reminders and bookings.
          </p>
        </div>
      )}

      <form action="/dashboard/update" method="POST" className="space-y-4">
        <input type="hidden" name="id" value={user.id} />

        <input
          name="name"
          defaultValue={profile?.name || ''}
          placeholder="Full Name"
          className="w-full border p-2 rounded"
        />

        <input
          name="slug"
          defaultValue={profile?.slug || ''}
          placeholder="dr-amit-jain"
          className="w-full border p-2 rounded"
        />

        <input
          name="whatsapp"
          defaultValue={profile?.whatsapp || ''}
          placeholder="+91-9000000000"
          className="w-full border p-2 rounded"
        />

        <input
          name="razorpay"
          defaultValue={profile?.razorpay || ''}
          placeholder="https://rzp.io/l/yourlink"
          className="w-full border p-2 rounded"
        />

        <textarea
          name="description"
          defaultValue={profile?.description || ''}
          placeholder="Write a short bio..."
          className="w-full border p-2 rounded"
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}

