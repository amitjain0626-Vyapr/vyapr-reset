// app/dashboard/leads/page.tsx
export const dynamic = "force-dynamic";

import LeadsTable from "./LeadsTable";
import NextDynamic from "next/dynamic"; // <-- alias to avoid clash

// Use a RELATIVE path to be safe with your setup
const SavedViewsControl = NextDynamic(
  () => import("../../../components/dashboard/SavedViewsControl"),
  { ssr: false }
);

export default async function LeadsPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-semibold">Leads</h1>
        <SavedViewsControl scope="leads" />
      </div>
      <LeadsTable />
    </div>
  );
}
