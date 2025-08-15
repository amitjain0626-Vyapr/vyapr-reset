// @ts-nocheck
"use client";
export default function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        window.location.href = "/login";
      }}
      className="rounded-xl border px-3 py-1.5"
    >
      Sign out
    </button>
  );
}
