// @ts-nocheck
"use client";

import { useState } from "react";
import { togglePublish } from "./publish-action";

export default function PublishToggle({ slug, current }) {
  const [published, setPublished] = useState(current);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setErrMsg(null);

    const res = await togglePublish(slug, !published);
    if (res.ok) {
      setPublished(!published);
    } else {
      // Replace alert with readable error panel
      if (res.error) {
        setErrMsg(
          typeof res.error === "string"
            ? res.error
            : JSON.stringify(res.error, null, 2)
        );
      } else {
        setErrMsg("Unknown error occurred while publishing.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2">
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

      {errMsg && (
        <div className="text-sm text-red-600 p-2 bg-red-50 rounded whitespace-pre-wrap">
          {errMsg}
        </div>
      )}
    </div>
  );
}
