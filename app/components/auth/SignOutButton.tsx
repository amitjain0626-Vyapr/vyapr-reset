// @ts-nocheck
"use client";

import { useState } from "react";
import { signOutAction } from "./signout-action";

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleSignOut = async () => {
    setLoading(true);
    setErrMsg(null);

    const res = await signOutAction();
    if (res.ok) {
      // reload to clear session
      window.location.href = "/";
    } else {
      if (res.error) {
        setErrMsg(
          typeof res.error === "string"
            ? res.error
            : JSON.stringify(res.error, null, 2)
        );
      } else {
        setErrMsg("Sign out failed. Please retry.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSignOut}
        disabled={loading}
        className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-60"
      >
        {loading ? "Signing out..." : "Sign Out"}
      </button>

      {errMsg && (
        <div className="text-sm text-red-600 p-2 bg-red-50 rounded whitespace-pre-wrap">
          {errMsg}
        </div>
      )}
    </div>
  );
}
