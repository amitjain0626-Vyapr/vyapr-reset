"use client";
// @ts-nocheck
import { useState } from "react";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signout", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      window.location.href = "/login";
    } catch {
      setBusy(false);
      alert("Sign out failed. Please retry.");
    }
  };

  return (
    <button onClick={signOut} disabled={busy} className={className || "px-3 py-1 rounded-xl border"}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
