// app/dashboard/leads/page.tsx
export const dynamic = "force-dynamic";

import LeadsTable from "./LeadsTable";
import dynamic from "next/dynamic";

// Dynamically import the SavedViewsControl to avoid SSR/client hook issues
const SavedViewsControl = dynamic(
  () => import("@/components/dashboard/SavedViewsControl"),
  { ssr: false }
);

export default async function LeadsPage() {
  // Server component shell; data is fetched by the client table via /api/leads
  return (
    <div className="p-4 md:p-6">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Leads</h1>

        {/* Saved Views Dropdown UI (Step 12.1) */}
        <SavedViewsControl scope="leads" />
      </div>

      {/* Leads Table */}
      <LeadsTable />
    </div>
  );
}
