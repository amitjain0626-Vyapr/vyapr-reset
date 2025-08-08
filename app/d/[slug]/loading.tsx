export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl p-10 space-y-4">
      <div className="animate-pulse h-7 w-64 bg-gray-200 rounded" />
      <div className="animate-pulse h-5 w-40 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-pulse h-64 bg-gray-200 rounded" />
        <div className="animate-pulse h-64 bg-gray-200 rounded" />
      </div>
      <div className="animate-pulse h-5 w-full bg-gray-200 rounded" />
      <div className="animate-pulse h-5 w-5/6 bg-gray-200 rounded" />
    </main>
  );
}
