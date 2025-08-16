"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function CreateTestOrderButton() {
  const [loading, setLoading] = useState(false);

  const handleCreateOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .insert([{ test: true, created_at: new Date().toISOString() }])
        .select()
        .single();

      if (error) throw error;
      alert(`Order created with ID: ${data.id}`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to create test order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCreateOrder}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded"
    >
      {loading ? "Creating..." : "Create Test Order"}
    </button>
  );
}
