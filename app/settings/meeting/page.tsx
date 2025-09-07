// app/settings/meeting/page.tsx
// @ts-nocheck
"use client";

/**
 * C3 — Meeting Modes (Provider Settings)
 * - Pick: in_person | phone | google_meet
 * - If google_meet: Create Meet (meet.new) + paste link
 * - Free-text notes (co-owned with AI later)
 * - Telemetry only: meeting.mode.selected, meeting.link.set, meeting.notes.updated
 * - No schema drift. Works with ?slug=&pid=
 */

import { useMemo, useState } from "react";

type Mode = "in_person" | "phone" | "google_meet";

async function logEvent(payload: {
  event: string;
  ts: number;
  provider_id: string | null;
  lead_id: string | null;
  source: Record<string, any>;
}) {
  try {
    await fetch("/api/events/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {}
}

function useQuery() {
  return useMemo(() => {
    const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return {
      slug: q.get("slug") || "",
      pid: q.get("pid") || "",
    };
  }, []);
}

export default function MeetingSettingsPage() {
  const { slug, pid } = useQuery();
  const [mode, setMode] = useState<Mode>("in_person");
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState<null | string>(null);

  async function chooseMode(next: Mode) {
    setMode(next);
    setSaving("mode");
    await logEvent({
      event: "meeting.mode.selected",
      ts: Date.now(),
      provider_id: pid || null,
      lead_id: null,
      source: { via: "web", slug: slug || null, mode: next },
    });
    setSaving(null);
  }

  async function saveLink() {
    if (!link.trim()) return;
    setSaving("link");
    await logEvent({
      event: "meeting.link.set",
      ts: Date.now(),
      provider_id: pid || null,
      lead_id: null,
      source: { via: "web", slug: slug || null, mode, link: link.trim() },
    });
    setSaving(null);
  }

  async function saveNotes() {
    if (!notes.trim()) return;
    setSaving("notes");
    await logEvent({
      event: "meeting.notes.updated",
      ts: Date.now(),
      provider_id: pid || null,
      lead_id: null,
      source: { via: "web", slug: slug || null, mode, notes: notes.trim(), length: notes.trim().length },
    });
    setSaving(null);
  }

  return (
    <main className="mx-auto max-w-lg p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Meeting mode</h1>
        <p className="text-sm text-gray-600">
          Provider: <span className="font-mono">{slug || "unknown"}</span>
          {pid ? <> • Provider ID: <span className="font-mono">{pid}</span></> : null}
        </p>
      </header>

      {/* Mode selection */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="text-sm font-medium">Choose how you meet customers</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => chooseMode("in_person")}
            className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${
              mode === "in_person" ? "bg-emerald-50 border-emerald-300" : ""
            }`}
            disabled={!!saving}
          >
            In person
          </button>
          <button
            onClick={() => chooseMode("phone")}
            className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${
              mode === "phone" ? "bg-emerald-50 border-emerald-300" : ""
            }`}
            disabled={!!saving}
          >
            Phone call
          </button>
          <button
            onClick={() => chooseMode("google_meet")}
            className={`rounded-full border px-3 py-1.5 text-sm hover:shadow-sm ${
              mode === "google_meet" ? "bg-emerald-50 border-emerald-300" : ""
            }`}
            disabled={!!saving}
          >
            Google Meet (online)
          </button>
        </div>

        {/* Google Meet helpers */}
        {mode === "google_meet" && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-gray-600">
              Tip: Click “Create Meet” to open a new meeting in a tab, copy the URL, then paste it here.
            </div>
            <div className="flex gap-2">
              <a
                href="https://meet.new"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm"
              >
                Create Meet
              </a>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/xyz-abcd-efg"
                className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
              />
              <button onClick={saveLink} className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm" disabled={!!saving}>
                Save link
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Free-text notes (AI-improvable later) */}
      <section className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="text-sm font-medium">Joining instructions (optional)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Example: Please join 5 mins early. Keep reports handy. We’ll reschedule if late by 10 mins…"
        />
        <div className="text-xs text-gray-500">We’ll improve this with AI later so it’s short, clear, and friendly.</div>
        <button onClick={saveNotes} className="rounded-full border px-3 py-1.5 text-sm hover:shadow-sm" disabled={!!saving}>
          Save notes
        </button>
      </section>

      <div className="text-xs text-gray-500">
        Telemetry only. Events: <span className="font-mono">meeting.mode.selected</span>,{" "}
        <span className="font-mono">meeting.link.set</span>, <span className="font-mono">meeting.notes.updated</span>.
      </div>
    </main>
  );
}
