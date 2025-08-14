// @ts-nocheck
"use client";

import { useState } from "react";
import { togglePublish } from "./publish-action";

export default function PublishToggle({ slug, current }) {
  const [published, setPublished] = useState(current);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const res = await togglePublish(slug, !published);
    if (res.ok) {
      setPublished(!published);
    } else {
      alert("Failed: " + res.error);
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`px-3 py-1 rounded text-sm ${
        published ? "bg-green-600 text-white" : "bg-gray-300"
      }`}
    >
      {loading
        ? "Saving..."
        : published
        ? "Published (Click to Unpublish)"
        : "Unpublished (Click to Publish)"}
    </button>
  );
}
