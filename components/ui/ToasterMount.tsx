// components/ui/ToasterMount.tsx
"use client";

import { Toaster } from "sonner";

export default function ToasterMount() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      // ensure it sits above any drawers/overlays
      style={{ zIndex: 999999 }}
    />
  );
}
