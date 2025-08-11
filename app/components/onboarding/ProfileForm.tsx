// components/onboarding/ProfileForm.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import ImageUploader from '@/components/uploader/ImageUploader';

type Dentist = {
  name?: string | null;
  phone?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  about?: string | null;
  services?: string | null;
  clinic_name?: string | null;
  clinic_address?: string | null;
  profile_image_url?: string | null;
  clinic_image_url?: string | null;
  razorpay_payment_link?: string | null;
  ondc_store_link?: string | null;
  website_url?: string | null;
  google_maps_link?: string | null;
  slug?: string | null;
  is_published?: boolean | null;
};

type Props = {
  prefill?: Dentist | null;
};

export default function ProfileForm({ prefill }: Props) {
  const [form, setForm] = React.useState<Dentist>({
    name: prefill?.name ?? '',
    phone: prefill?.phone ?? '',
    whatsapp_number: prefill?.whatsapp_number ?? '',
    email: prefill?.email ?? '',
    city: prefill?.city ?? '',
    address: prefill?.address ?? '',
    about: prefill?.about ?? '',
    services: prefill?.services ?? '',
    clinic_name: prefill?.clinic_name ?? '',
    clinic_address: prefill?.clinic_address ?? '',
    profile_image_url: prefill?.profile_image_url ?? '',
    clinic_image_url: prefill?.clinic_image_url ?? '',
    razorpay_payment_link: prefill?.razorpay_payment_link ?? '',
    ondc_store_link: prefill?.ondc_store_link ?? '',
    website_url: prefill?.website_url ?? '',
    google_maps_link: prefill?.google_maps_link ?? '',
    slug: prefill?.slug ?? '',
    is_published: prefill?.is_published ?? false,
  });

  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Debounced autosave on form changes
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  function queueSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(false), 500);
  }

  function onChange<K extends keyof Dentist>(key: K, value: Dentist[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    queueSave();
  }

  function normalizeSlug(s: string) {
    return s
      ?.toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') ?? '';
  }

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, any> = {
        ...form,
      };
      if (body.slug) body.slug = normalizeSlug(body.slug);
      if (publish) body.is_published = true;

      const res = await fetch('/api/dentist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json?.ok) {
        // Show specific slug conflict if any
        if (res.status === 409 && json?.slug) {
          throw new Error(`Slug "${json.slug}" is already in use. Try another.`);
        }
        throw new Error(json?.error || 'Save failed');
      }

      // Reflect any normalized fields returned from server
      if (json?.data) {
        setForm((f) => ({
          ...f,
          slug: json.data.slug ?? f.slug,
          is_published: json.data.is_published ?? f.is_published,
          profile_image_url: json.data.profile_image_url ?? f.profile_image_url,
          clinic_image_url: json.data.clinic_image_url ?? f.clinic_image_url,
        }));
      }

      setSavedAt(new Date().toLocaleTimeString());
    } catch (e: any) {
      setError(e?.message || 'Save error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="max-w-3xl mx-auto space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
    >
      {/* Header + status */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your profile</h1>
        <div className="text-sm">
          {saving ? (
            <span className="text-gray-500">Saving…</span>
          ) : savedAt ? (
            <span className="text-green-600">Saved ✓ {savedAt}</span>
          ) : (
            <span className="text-gray-400">Not saved yet</span>
          )}
        </div>
      </div>

      {/* Images */}
      <div className="space-y-4">
        <ImageUploader
          label="Profile photo"
          fieldKey="profile_image_url"
          value={form.profile_image_url || undefined}
          onUploaded={(url) => setForm((f) => ({ ...f, profile_image_url: url }))}
        />
        <ImageUploader
          label="Clinic photo"
          fieldKey="clinic_image_url"
          value={form.clinic_image_url || undefined}
          onUploaded={(url) => setForm((f) => ({ ...f, clinic_image_url: url }))}
        />
      </div>

      {/* Basic info */}
      <section className="rounded-2xl border p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Full name"
            value={form.name ?? ''}
            onChange={(v) => onChange('name', v)}
          />
          <Field
            label="City"
            value={form.city ?? ''}
            onChange={(v) => onChange('city', v)}
          />
          <Field
            label="Phone"
            value={form.phone ?? ''}
            onChange={(v) => onChange('phone', v)}
            placeholder="+91 98xxxxxxx"
          />
          <Field
            label="WhatsApp Number (optional)"
            value={form.whatsapp_number ?? ''}
            onChange={(v) => onChange('whatsapp_number', v)}
            placeholder="10-digit or with country code"
          />
          <Field
            label="Website (optional)"
            value={form.website_url ?? ''}
            onChange={(v) => onChange('website_url', v)}
            placeholder="example.com or https://example.com"
          />
          <Field
            label="Google Maps Link (optional)"
            value={form.google_maps_link ?? ''}
            onChange={(v) => onChange('google_maps_link', v)}
            placeholder="https://maps.google.com/…"
          />
        </div>

        <TextArea
          label="Clinic address"
          value={form.clinic_address ?? form.address ?? ''}
          onChange={(v) => {
            onChange('clinic_address', v);
            if (!form.address) onChange('address', v);
          }}
          rows={2}
        />

        <TextArea
          label="About"
          value={form.about ?? ''}
          onChange={(v) => onChange('about', v)}
          rows={4}
          placeholder="Short intro, experience, approach to care…"
        />

        <TextArea
          label="Services"
          value={form.services ?? ''}
          onChange={(v) => onChange('services', v)}
          rows={3}
          placeholder="Root canal, braces, cleaning, whitening…"
        />
      </section>

      {/* Links / Payments */}
      <section className="rounded-2xl border p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Razorpay Payment Link (optional)"
            value={form.razorpay_payment_link ?? ''}
            onChange={(v) => onChange('razorpay_payment_link', v)}
            placeholder="https://rzp.io/…"
          />
          <Field
            label="ONDC Store Link (optional)"
            value={form.ondc_store_link ?? ''}
            onChange={(v) => onChange('ondc_store_link', v)}
            placeholder="https://ondc.…"
          />
        </div>
      </section>

      {/* Publishing */}
      <section className="rounded-2xl border p-4 md:p-6 space-y-3">
        <Field
          label="Microsite slug"
          value={form.slug ?? ''}
          onChange={(v) => onChange('slug', normalizeSlug(v))}
          prefix="/d/"
          placeholder="your-name"
        />

        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Publish microsite</div>
            <div className="text-xs text-gray-500">
              Makes your page live at <span className="font-mono">/d/{form.slug || 'your-slug'}</span>
            </div>
            {error ? <div className="text-sm text-red-600 mt-2">{error}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => save(true)}
            className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          >
            {saving ? 'Publishing…' : 'Publish / Update Live'}
          </button>
        </div>
      </section>

      {/* Manual Save */}
      <div className="flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

/* --- Small field helpers --- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1">{label}</div>
      <div className="flex">
        {prefix ? (
          <span className="inline-flex items-center px-2 rounded-l-md border border-r-0 bg-gray-50 text-gray-600 text-sm">
            {prefix}
          </span>
        ) : null}
        <input
          className={`w-full rounded-${prefix ? 'r' : ''}-md border px-3 py-2 text-sm`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1">{label}</div>
      <textarea
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
      />
    </label>
  );
}
