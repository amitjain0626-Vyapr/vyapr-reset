'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [description, setDescription] = useState('');

  const generateSlug = (value: string) =>
    value.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const handleSubmit = async () => {
    const user = (await supabase.auth.getUser()).data.user;

    await supabase.from('Dentists').upsert({
      id: user?.id,
      name,
      slug,
      whatsapp,
      description,
      updated_at: new Date().toISOString(),
    });

    router.push('/dashboard');
  };

  return (
    <div className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🚀 Let’s set up your profile</h1>

      {step === 1 && (
        <>
          <p className="mb-2">What's your full name?</p>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const val = e.target.value;
              setName(val);
              setSlug(generateSlug(val));
            }}
            placeholder="Dr. Amit Jain"
            className="w-full border p-2 rounded"
          />
          <button
            onClick={() => setStep(2)}
            className="mt-4 w-full bg-black text-white py-2 rounded"
          >
            Next
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <p className="mb-2">We’ve suggested this slug for your site:</p>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full border p-2 rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Your link will be: vyapr.com/d/{slug}</p>
          <button
            onClick={() => setStep(3)}
            className="mt-4 w-full bg-black text-white py-2 rounded"
          >
            Next
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <p className="mb-2">WhatsApp number (clients can reach you directly):</p>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+91-9000000000"
            className="w-full border p-2 rounded"
          />
          <button
            onClick={() => setStep(4)}
            className="mt-4 w-full bg-black text-white py-2 rounded"
          >
            Next
          </button>
        </>
      )}

      {step === 4 && (
        <>
          <p className="mb-2">Short description or intro:</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: 10+ years experience in cosmetic dentistry, trusted by 1000+ smiles."
            className="w-full border p-2 rounded"
          />
          <button
            onClick={handleSubmit}
            className="mt-4 w-full bg-green-600 text-white py-2 rounded"
          >
            Finish & Go to Dashboard
          </button>
        </>
      )}
    </div>
  );
}
