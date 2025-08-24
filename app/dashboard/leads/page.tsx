// app/dashboard/leads/page.tsx
export const dynamic = 'force-dynamic'

import LeadsTable from './LeadsTable'
import Toolbar from './Toolbar' // client component

export default async function LeadsPage() {
  return (
    <div className="p-4 md:p-6">
      <Toolbar />
      <LeadsTable />
    </div>
  )
}
