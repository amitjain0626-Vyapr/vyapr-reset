'use client'
// @ts-nocheck

import SavedViewsControl from '../../../components/dashboard/SavedViewsControl'
import Filters from './Filters'

export default function Toolbar() {
  return (
    <div className="mb-4 space-y-3">
      {/* Row 1: Title + Saved Views */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        <SavedViewsControl scope="leads" />
      </div>

      {/* Row 2: Filters (URL-driven) */}
      <Filters />
    </div>
  )
}
