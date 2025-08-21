// app/dashboard/leads/page.tsx
export const dynamic = "force-dynamic";

import LeadsTable from "./LeadsTable";

export default async function LeadsPage() {
  // Server component shell; data is fetched by the client table via /api/leads
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">Leads</h1>
      <LeadsTable />
    </div>
  );
}
