export default function LoadingCourse() {
  return (
    <div aria-busy="true" aria-label="Đang tải khóa học">
      <div className="h-56 animate-pulse bg-slate-200" />
      <div className="container-x grid gap-8 py-12 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-slate-100" />)}</div>
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
