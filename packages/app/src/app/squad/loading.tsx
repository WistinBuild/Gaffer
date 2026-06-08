export default function Loading() {
  return (
    <main className="relative min-h-[100dvh] pt-32 sm:pt-36 pb-24 px-4 sm:px-8">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="h-6 w-40 rounded-full bg-white/[0.04] mb-6" />
        <div className="h-20 w-3/4 rounded-2xl bg-white/[0.04] mb-3" />
        <div className="h-5 w-1/2 rounded-full bg-white/[0.04] mb-10" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Pitch panel skeleton */}
          <div className="lg:col-span-5">
            <div className="rounded-[2rem] p-1.5 bg-white/[0.04]">
              <div className="rounded-[calc(2rem-0.375rem)] bg-gaffer-surface/40 p-6 h-[420px]" />
            </div>
          </div>
          {/* Player grid skeleton */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
