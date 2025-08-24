use client'
// @ts-nocheck

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type SavedView = {
  id: string
  name: string
  path: string
  query?: string
  scope?: string
  created_at?: string
}

export default function SavedViewsControl({ scope = 'leads' }: { scope?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [views, setViews] = useState<SavedView[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind?: 'ok' | 'err' } | null>(null)

  const currentQuery = useMemo(() => {
    const qs = searchParams?.toString()
    return qs ? `?${qs}` : ''
  }, [searchParams])

  function notify(msg: string, kind: 'ok' | 'err' = 'ok') {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 2500)
  }

  async function load() {
    try {
      const url = `/api/saved-views?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(pathname || '')}`
      const r = await fetch(url, { credentials: 'include' })
      if (!r.ok) throw new Error(`List failed: ${r.status}`)
      const data = await r.json()
      setViews(Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []))
    } catch (e) {
      console.error(e)
      // Silent: page still works without saved views list
    }
  }

  useEffect(() => { load() }, [pathname, scope])

  async function save() {
    if (!newName?.trim()) { notify('Name this view', 'err'); return }
    setBusy(true)
    try {
      const body = { name: newName.trim(), scope, path: pathname, query: currentQuery }
      const r = await fetch('/api/saved-views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error(`Save failed: ${r.status}`)
      const saved = await r.json()
      setOpen(false)
      setNewName('')
      notify('Saved view created')
      await load()
      setSelectedId(saved?.id || '')
    } catch (e) {
      console.error(e)
      notify('Could not save view', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: string) {
    if (!id) return
    setBusy(true)
    try {
      const r = await fetch(`/api/saved-views/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!r.ok) throw new Error(`Delete failed: ${r.status}`)
      notify('Saved view deleted')
      await load()
      setSelectedId('')
    } catch (e) {
      console.error(e)
      notify('Could not delete', 'err')
    } finally {
      setBusy(false)
    }
  }

  function apply(id: string) {
    const v = views.find(v => v.id === id)
    if (!v) return
    const next = `${v.path || pathname}${v.query || ''}`
    router.push(next)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Dropdown */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-500">Views</label>
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => { const id = e.target.value; setSelectedId(id); if (id) apply(id) }}
        >
          <option value="">— Select —</option>
          {views.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        {selectedId ? (
          <button
            type="button"
            onClick={() => del(selectedId)}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-red-50 disabled:opacity-50"
            disabled={busy}
            title="Delete selected view"
          >
            Delete
          </button>
        ) : null}
      </div>

      {/* Save current */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
        disabled={busy}
        title="Save current filters as a view"
      >
        Save current
      </button>

      {/* Tiny toast (no alerts) */}
      {toast ? (
        <div
          className={`fixed right-4 top-4 z-[100] rounded-xl px-4 py-2 text-sm shadow ${toast.kind === 'err' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      {/* Minimal modal */}
      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 text-base font-semibold">Save current view</div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g., New leads (MTD)"
              className="mb-4 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-xl bg-black px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                disabled={busy}
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              Capturing path <span className="font-mono">{pathname}</span> and query{' '}
              <span className="font-mono">{currentQuery || '— none —'}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
