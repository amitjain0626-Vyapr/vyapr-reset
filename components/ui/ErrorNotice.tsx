// @ts-nocheck
"use client";

export default function ErrorNotice({ title = "Something went wrong", message, retry }: {
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
      <div className="font-semibold mb-1">{title}</div>
      {message && <div className="text-sm opacity-90">{message}</div>}
      {retry && (
        <button
          onClick={retry}
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-white text-sm hover:bg-red-700">
          Retry
        </button>
      )}
    </div>
  );
}
