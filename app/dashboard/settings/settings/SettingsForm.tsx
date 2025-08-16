"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function SettingsForm({ provider }: { provider: any }) {
  const [clinicName, setClinicName] = useState(provider?.clinic_name || "");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase
        .from("providers")
        .update({ clinic_name: clinicName })
        .eq("id", provider.id);

      if (error) throw error;
      alert("Settings saved!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block font-medium">Clinic Name</label>
        <input
          type="text"
          value={clinicName}
          onChange={(e) => setClinicName(e.target.value)}
          className="border px-2 py-1 rounded w-full"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        {loading ? "Saving..." : "Save Settings"}
      </button>
    </form>
  );
}
