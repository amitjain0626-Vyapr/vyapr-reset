// components/ui/SafeImg.tsx
'use client';

import * as React from 'react';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: React.ReactNode;
};

export default function SafeImg({ fallback, ...imgProps }: Props) {
  const [err, setErr] = React.useState(false);

  if (err) return <>{fallback ?? null}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...imgProps}
      onError={() => setErr(true)}
    />
  );
}
