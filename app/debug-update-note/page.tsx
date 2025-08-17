// app/debug-update-note/page.tsx
"use client";
import { useState } from "react";

export default function DebugUpdateNote() {
  const [result, setResult] = useState<any>(null);

  async function updateNote() {
    const res = await fetch("/api/leads/update-note", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "5a1c7390-c8ba-47a4-b8da-6e229ddacdbd",
        note: "Follow-up Friday @ 5pm"
      }),
      credentials: "include",
    });
    const json = await res.json();
    setResult(json);
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Debug Update Note</h1>
      <button
        onClick={updateNote}
        style={{ padding: "8px 16px", background: "blue", color: "white", border: "none", borderRadius: "4px" }}
      >
        Update Note
      </button>
      {result && (
        <pre style={{ marginTop: 20, background: "#eee", padding: 10 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
