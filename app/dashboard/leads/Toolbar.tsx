'use client'
// @ts-nocheck

import SavedViewsControl from '../../../components/dashboard/SavedViewsControl'

export default function Toolbar() {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 className="text-xl font-semibold">Leads</h1>
      <SavedViewsControl scope="leads" />
    </div>
  )
}
