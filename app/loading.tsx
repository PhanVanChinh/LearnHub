/** Skeleton chung khi chuyển route (Server Component đang tải dữ liệu). Route riêng có thể ghi đè bằng loading.tsx của nó. */
export default function Loading() {
  return (
    <div className="container-x py-12" aria-busy="true" aria-label="Đang tải">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="aspect-[16/9] animate-pulse bg-slate-100" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-3/5 animate-pulse rounded bg-slate-100" />
              <div className="mt-4 h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
