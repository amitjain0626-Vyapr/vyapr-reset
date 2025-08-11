// components/uploader/ImageUploader.tsx
// @ts-nocheck
'use client';

import * as React from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Props = {
  label: string;
  fieldKey: 'profile_image_url' | 'clinic_image_url';
  value?: string | null;
  onUploaded?: (url: string) => void;
};

function supabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function ImageUploader({ label, fieldKey, value, onUploaded }: Props) {
  const [uploading, setUploading] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(value ?? null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const onPick = () => inputRef.current?.click();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const supabase = supabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const name = `${Date.now()}-${fieldKey}.${ext}`;
      const path = `${user.id}/${name}`;

      // Upload
      const { error: upErr } = await supabase.storage
        .from('dentist-media')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      // Public URL
      const { data } = supabase.storage.from('dentist-media').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      setPreview(publicUrl);

      // Persist to Dentists table
      const res = await fetch('/api/dentist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldKey]: publicUrl }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Save failed');

      onUploaded?.(publicUrl);
    } catch (err) {
      console.error(err);
      alert('Upload failed. Try a smaller JPG/PNG/WebP under 5MB.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border shadow-sm">
      <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm text-gray-500">No image</span>
        )}
      </div>

      <div className="flex-1">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-xs text-gray-500 mb-3">
          JPG/PNG/WebP • up to 5MB
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
          >
            {uploading ? 'Uploading…' : 'Upload image'}
          </button>
          {preview && (
            <a
              href={preview}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline"
            >
              View
            </a>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}
