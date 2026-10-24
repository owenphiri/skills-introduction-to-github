export default function Loading() {
  return (
    <div className="container py-32" role="status" aria-label="Loading page">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="mx-auto h-4 w-40 animate-pulse rounded-full bg-muted" />
        <div className="mx-auto h-14 w-3/4 animate-pulse rounded-2xl bg-muted" />
        <div className="mx-auto h-4 w-1/2 animate-pulse rounded-full bg-muted" />
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
