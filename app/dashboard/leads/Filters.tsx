// app/dashboard/leads/Filters.tsx
'use client'
// @ts-nocheck

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

function useQuerySync() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParams = (patch: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '') params.delete(k)
      else params.set(k, String(v))
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return { pathname, searchParams, setParams }
}

function Pill({ active, onClick, children }: { active?: boolean; onClick: () => void; children: any }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition
        ${active ? 'bg-black text-white border-black' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
    >
      {children}
    </button>
  )
}

export default function Filters() {
  const { searchParams, setParams } = useQuerySync()

  // current values from URL
  const range = (searchParams?.get('range') || '').toLowerCase() // 'today' | '7d' | '30d'
  const status = (searchParams?.get('status') || '').toLowerCase() // 'new' | 'contacted' | 'converted' | ''

  const onRange = (value: string) => setParams({ range: value })
  const onStatus = (value: string) => setParams({ status: value || null }) // drop when empty

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'All statuses' },
      { value: 'new', label: 'New' },
      { value: 'contacted', label: 'Contacted' },
      { value: 'converted', label: 'Converted' },
      { value: 'lost', label: 'Lost' },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      {/* LEFT: Date range pills */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Range</span>
        <div className="flex items-center gap-1.5">
          <Pill active={range === 'today'} onClick={() => onRange('today')}>Today</Pill>
          <Pill active={range === '7d'} onClick={() => onRange('7d')}>7D</Pill>
          <Pill active={range === '30d'} onClick={() => onRange('30d')}>30D</Pill>
          <Pill active={!range} onClick={() => onRange('')}>All</Pill>
        </div>
      </div>

      {/* RIGHT: Status select */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Status</span>
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
