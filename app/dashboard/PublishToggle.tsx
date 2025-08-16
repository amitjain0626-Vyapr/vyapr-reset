"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function PublishToggle({ providerId, published }: { providerId: string; published: boolean }) {
  const [isPublished, setIsPublished] = useState(published);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("providers")
        .update({ published: !isPublished })
        .eq("id", providerId);

      if (error) throw error;
      setIsPublished(!isPublished);
    } catch (err: any) {
      console.error(err);
      alert("Failed to update publish status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-4 py-2 rounded ${isPublished ? "bg-green-600 text-white" : "bg-gray-300 text-black"}`}
    >
      {loading ? "Saving..." : isPublished ? "Published" : "Unpublished"}
    </button>
  );
}
