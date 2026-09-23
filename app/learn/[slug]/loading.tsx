export default function LoadingLearn() {
  return (
    <div className="bg-slate-950 text-slate-100" aria-busy="true" aria-label="Đang tải bài học">
      <div className="border-b border-white/10"><div className="container-x h-14" /></div>
      <div className="container-x grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <div className="aspect-video animate-pulse rounded-xl bg-white/10" />
          <div className="mt-5 h-7 w-2/3 animate-pulse rounded bg-white/10" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-white/5" />
      </div>
    </div>
  );
}
